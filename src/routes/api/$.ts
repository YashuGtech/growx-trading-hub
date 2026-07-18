// Single splat route that dispatches every /api/* endpoint the GrowX HTML
// pages call. Keeping this in one file avoids fragmenting the app across
// dozens of tiny TanStack routes.
import { createFileRoute } from "@tanstack/react-router";
import {
  db, hashPassword, verifyPassword, randomCode, randomTradeId, randomPassword,
  createSession, createTradeSession, getUserFromRequest, getTradeAccountFromRequest,
  cookieHeader, clearCookieHeader, sendEmail, json,
} from "@/lib/growx.server";

async function readJson(request: Request): Promise<any> {
  try { return await request.json(); } catch { return {}; }
}

async function handle(request: Request, params: { _splat?: string }): Promise<Response> {
  const path = "/" + (params._splat || "");
  const method = request.method.toUpperCase();
  const url = new URL(request.url);

  // ---------------- AUTH ----------------
  if (path === "/auth/signup" && method === "POST") {
    const b = await readJson(request);
    const email = String(b.email || "").toLowerCase().trim();
    const password = String(b.password || "");
    if (!email || password.length < 6) return json({ ok: false, error: "Invalid email or password" }, { status: 400 });
    const existing = await db.from("users").select("id, email_verified").eq("email", email).maybeSingle();
    let userId: number;
    if (existing.data) {
      if (existing.data.email_verified) return json({ ok: false, error: "Email already registered" }, { status: 409 });
      userId = existing.data.id as number;
      await db.from("users").update({
        name: b.name || null, country_code: b.country_code || null, phone: b.phone || null,
        country: b.country || null, password_hash: await hashPassword(password),
      }).eq("id", userId);
    } else {
      const ins = await db.from("users").insert({
        name: b.name || null, email, country_code: b.country_code || null, phone: b.phone || null,
        country: b.country || null, password_hash: await hashPassword(password),
      }).select("id").single();
      if (ins.error || !ins.data) return json({ ok: false, error: "Failed to create user" }, { status: 500 });
      userId = ins.data.id as number;
    }
    const code = randomCode(6);
    await db.from("email_otps").insert({
      user_id: userId, email, code_hash: await hashPassword(code),
      purpose: "signup", expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });
    await sendEmail({
      to: email, subject: "Verify your GrowX account",
      html: `<p>Your GrowX verification code is <b style="font-size:20px;letter-spacing:3px">${code}</b>. It expires in 15 minutes.</p>`,
    });
    return json({ ok: true, message: "Verification code sent" });
  }

  if (path === "/auth/verify-email" && method === "POST") {
    const b = await readJson(request);
    const email = String(b.email || "").toLowerCase().trim();
    const code = String(b.code || b.otp || "");
    const row = await db.from("email_otps")
      .select("*").eq("email", email).eq("purpose", "signup").eq("used", false)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!row.data) return json({ ok: false, error: "No pending code" }, { status: 400 });
    if (new Date(row.data.expires_at as string) < new Date()) return json({ ok: false, error: "Code expired" }, { status: 400 });
    const ok = await verifyPassword(code, row.data.code_hash as string);
    if (!ok) {
      await db.from("email_otps").update({ attempts: (row.data.attempts as number) + 1 }).eq("id", row.data.id);
      return json({ ok: false, error: "Invalid code" }, { status: 400 });
    }
    await db.from("email_otps").update({ used: true }).eq("id", row.data.id);
    await db.from("users").update({ email_verified: true }).eq("email", email);
    const user = await db.from("users").select("id").eq("email", email).single();
    const token = await createSession(user.data!.id as number);
    return json({ ok: true, message: "Verified" }, { headers: { "Set-Cookie": cookieHeader("gx_session", token) } });
  }

  if (path === "/auth/resend-otp" && method === "POST") {
    const b = await readJson(request);
    const email = String(b.email || "").toLowerCase().trim();
    const user = await db.from("users").select("id").eq("email", email).maybeSingle();
    if (!user.data) return json({ ok: true });
    const code = randomCode(6);
    await db.from("email_otps").insert({
      user_id: user.data.id, email, code_hash: await hashPassword(code),
      purpose: "signup", expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });
    await sendEmail({ to: email, subject: "Your GrowX verification code",
      html: `<p>Your code is <b style="font-size:20px;letter-spacing:3px">${code}</b>.</p>` });
    return json({ ok: true });
  }

  if (path === "/auth/login" && method === "POST") {
    const b = await readJson(request);
    const email = String(b.email || "").toLowerCase().trim();
    const password = String(b.password || "");
    const user = await db.from("users").select("*").eq("email", email).maybeSingle();
    if (!user.data) return json({ ok: false, error: "Invalid credentials" }, { status: 401 });
    const ok = await verifyPassword(password, user.data.password_hash as string);
    if (!ok) return json({ ok: false, error: "Invalid credentials" }, { status: 401 });
    if (!user.data.email_verified) return json({ ok: false, error: "email_unverified", needsVerification: true }, { status: 403 });
    const token = await createSession(user.data.id as number);
    return json({ ok: true, user: { id: user.data.id, email: user.data.email, name: user.data.name, is_admin: user.data.is_admin } },
      { headers: { "Set-Cookie": cookieHeader("gx_session", token) } });
  }

  if (path === "/auth/me" && method === "GET") {
    const u = await getUserFromRequest(request);
    if (!u) return json({ ok: false }, { status: 401 });
    return json({ ok: true, user: { id: u.id, email: u.email, name: u.name, is_admin: u.is_admin, email_verified: u.email_verified } });
  }

  if (path === "/auth/logout" && method === "POST") {
    return json({ ok: true }, { headers: { "Set-Cookie": clearCookieHeader("gx_session") } });
  }

  if (path === "/auth/forgot-password" && method === "POST") {
    const b = await readJson(request);
    const email = String(b.email || "").toLowerCase().trim();
    const user = await db.from("users").select("id").eq("email", email).maybeSingle();
    if (user.data) {
      const code = randomCode(6);
      await db.from("email_otps").insert({
        user_id: user.data.id, email, code_hash: await hashPassword(code),
        purpose: "reset", expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });
      await sendEmail({ to: email, subject: "GrowX password reset code",
        html: `<p>Your GrowX password reset code is <b style="font-size:20px;letter-spacing:3px">${code}</b>. It expires in 30 minutes.</p>` });
    }
    return json({ ok: true });
  }

  if (path === "/auth/reset-password" && method === "POST") {
    const b = await readJson(request);
    const email = String(b.email || "").toLowerCase().trim();
    const code = String(b.code || b.otp || "");
    const password = String(b.password || "");
    if (password.length < 6) return json({ ok: false, error: "Password too short" }, { status: 400 });
    const row = await db.from("email_otps")
      .select("*").eq("email", email).eq("purpose", "reset").eq("used", false)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!row.data) return json({ ok: false, error: "No pending reset" }, { status: 400 });
    if (new Date(row.data.expires_at as string) < new Date()) return json({ ok: false, error: "Code expired" }, { status: 400 });
    const ok = await verifyPassword(code, row.data.code_hash as string);
    if (!ok) return json({ ok: false, error: "Invalid code" }, { status: 400 });
    await db.from("email_otps").update({ used: true }).eq("id", row.data.id);
    await db.from("users").update({ password_hash: await hashPassword(password) }).eq("email", email);
    return json({ ok: true });
  }

  // ---------------- ORDERS / DEPOSITS ----------------
  if (path === "/orders" && method === "POST") {
    const user = await getUserFromRequest(request);
    if (!user) return json({ ok: false, error: "unauthorized" }, { status: 401 });
    const b = await readJson(request);
    const ins = await db.from("orders").insert({
      user_id: user.id, plan: b.plan, balance: b.balance,
      price_usd: b.price_usd, network: b.network, tx_hash: b.tx_hash, status: "pending_verification",
    }).select("*").single();
    if (b.tx_hash) {
      await db.from("deposits").insert({
        user_id: user.id, order_id: ins.data!.id, amount_usdt: b.price_usd,
        network: b.network, tx_hash: b.tx_hash, internal_status: "pending_verification",
      });
    }
    return json({ ok: true, order: ins.data });
  }

  if (path === "/orders" && method === "GET") {
    const user = await getUserFromRequest(request);
    if (!user) return json({ ok: false }, { status: 401 });
    const q = user.is_admin
      ? await db.from("orders").select("*").order("created_at", { ascending: false }).limit(200)
      : await db.from("orders").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    return json({ ok: true, rows: q.data || [] });
  }

  // Generic admin list: /deposits, /withdrawals, /refunds, /tickets, /complaints, /kyc, /emails, /cases, /escalations, /notes, /activity, /payments
  const listMap: Record<string, string> = {
    "/deposits": "deposits", "/withdrawals": "withdrawals", "/refunds": "refunds",
    "/tickets": "support_tickets", "/complaints": "complaints", "/kyc": "kyc_records",
    "/emails": "email_queue", "/escalations": "escalations", "/notes": "internal_notes",
    "/activity": "activity_logs", "/payments": "orders",
  };
  if (listMap[path] && method === "GET") {
    const user = await getUserFromRequest(request);
    const table = listMap[path];
    const isAdmin = user?.is_admin;
    const orderCol = table === "email_queue" ? "scheduled_at" : "created_at";
    let q: any = (db.from as any)(table).select("*").order(orderCol, { ascending: false }).limit(200);
    if (!isAdmin && user) q = (db.from as any)(table).select("*").eq("user_id", user.id).order(orderCol, { ascending: false });
    const r = await q;
    return json({ ok: true, rows: r.data || [] });
  }
  if (path === "/cases" && method === "GET") {
    const [t, c] = await Promise.all([
      db.from("support_tickets").select("*").order("created_at", { ascending: false }).limit(100),
      db.from("complaints").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    const rows = [
      ...(t.data || []).map((r: any) => ({ ...r, case_type: "ticket" })),
      ...(c.data || []).map((r: any) => ({ ...r, case_type: "complaint" })),
    ];
    return json({ ok: true, rows });
  }

  // ---------------- ADMIN: approve order → issue trade account ----------------
  if (path === "/admin/approve-order" && method === "POST") {
    const user = await getUserFromRequest(request);
    if (!user?.is_admin) return json({ ok: false, error: "forbidden" }, { status: 403 });
    const b = await readJson(request);
    const order = await db.from("orders").select("*").eq("id", b.order_id).single();
    if (!order.data) return json({ ok: false, error: "not found" }, { status: 404 });
    const tradeId = randomTradeId();
    const password = randomPassword(10);
    const startingBalance = Number(String(order.data.balance || "10000").replace(/[^0-9.]/g, "")) || 10000;
    const acc = await db.from("trade_accounts").insert({
      user_id: order.data.user_id, order_id: order.data.id, trade_id: tradeId,
      password_hash: await hashPassword(password), password_plain: password,
      plan: order.data.plan || "Stellar 1",
      starting_balance: startingBalance, balance: startingBalance, equity: startingBalance,
      leverage: 100, status: "active",
    }).select("*").single();
    await db.from("orders").update({ status: "approved" }).eq("id", order.data.id);
    await db.from("deposits").update({ internal_status: "verified", verified_at: new Date().toISOString() }).eq("order_id", order.data.id);
    const owner = await db.from("users").select("email, name").eq("id", order.data.user_id).single();
    if (owner.data?.email) {
      await sendEmail({
        to: owner.data.email,
        subject: "Your GrowX trading account is ready",
        html: `<div style="font-family:Inter,Arial,sans-serif">
          <h2>Welcome, ${owner.data.name || "Trader"}</h2>
          <p>Your <b>${acc.data!.plan}</b> account has been approved. Log in to the GrowX trading terminal with:</p>
          <table style="background:#0b1220;color:#fff;padding:16px;border-radius:12px;font-size:16px">
            <tr><td style="opacity:.7;padding:4px 12px">Trade ID</td><td style="padding:4px 12px"><b>${tradeId}</b></td></tr>
            <tr><td style="opacity:.7;padding:4px 12px">Password</td><td style="padding:4px 12px"><b>${password}</b></td></tr>
            <tr><td style="opacity:.7;padding:4px 12px">Starting Balance</td><td style="padding:4px 12px">$${startingBalance.toLocaleString()}</td></tr>
            <tr><td style="opacity:.7;padding:4px 12px">Leverage</td><td style="padding:4px 12px">1:100</td></tr>
          </table>
          <p><a href="${url.origin}/trade-terminal-login.html" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:12px">Open Trading Terminal</a></p>
        </div>`,
      });
    }
    return json({ ok: true, trade_id: tradeId, password });
  }

  // ---------------- TRADE ACCOUNT AUTH ----------------
  if ((path === "/trade/instant-issue" || path === "/trade/issue") && method === "POST") {
    const user = await getUserFromRequest(request);
    if (!user) return json({ ok: false, error: "unauthorized" }, { status: 401 });

    // If this user already has an active trade account, return the most recent one.
    const existing = await db.from("trade_accounts")
      .select("*").eq("user_id", user.id)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (existing.data) {
      const acc = existing.data as any;
      return json({
        ok: true, trade_id: acc.trade_id, password: acc.password_plain,
        plan: acc.plan, starting_balance: Number(acc.starting_balance),
        balance: Number(acc.balance), leverage: acc.leverage,
      });
    }

    // Otherwise find latest order and mint credentials instantly (no admin approval).
    let order = (await db.from("orders").select("*").eq("user_id", user.id)
      .order("created_at", { ascending: false }).limit(1).maybeSingle()).data as any;

    // If no order exists at all, allow body to seed one (fallback).
    if (!order) {
      const b = await readJson(request);
      if (!b?.plan) return json({ ok: false, error: "no_order" }, { status: 400 });
      const ins = await db.from("orders").insert({
        user_id: user.id, plan: b.plan, balance: b.balance,
        price_usd: b.price_usd, network: b.network || "TRC20",
        tx_hash: b.tx_hash || null, status: "pending_verification",
      }).select("*").single();
      order = ins.data;
    }

    const tradeId = randomTradeId();
    const password = randomPassword(10);
    const startingBalance = Number(String(order.balance || "10000").replace(/[^0-9.]/g, "")) || 10000;
    const acc = await db.from("trade_accounts").insert({
      user_id: user.id, order_id: order.id, trade_id: tradeId,
      password_hash: await hashPassword(password), password_plain: password,
      plan: order.plan || "Stellar 1",
      starting_balance: startingBalance, balance: startingBalance, equity: startingBalance,
      leverage: 100, status: "active",
    }).select("*").single();
    if (acc.error || !acc.data) return json({ ok: false, error: "issue_failed" }, { status: 500 });

    await db.from("orders").update({ status: "approved" }).eq("id", order.id);
    await db.from("deposits").update({
      internal_status: "verified", verified_at: new Date().toISOString(),
    }).eq("order_id", order.id);

    // Fire-and-forget welcome email with credentials.
    if (user.email) {
      await sendEmail({
        to: user.email,
        subject: "Your GrowX trading account is ready",
        html: `<div style="font-family:Inter,Arial,sans-serif">
          <h2>Welcome, ${user.name || "Trader"}</h2>
          <p>Your <b>${acc.data.plan}</b> account is live. Log in to the GrowX trading terminal with:</p>
          <table style="background:#0b1220;color:#fff;padding:16px;border-radius:12px;font-size:16px">
            <tr><td style="opacity:.7;padding:4px 12px">Trade ID</td><td style="padding:4px 12px"><b>${tradeId}</b></td></tr>
            <tr><td style="opacity:.7;padding:4px 12px">Password</td><td style="padding:4px 12px"><b>${password}</b></td></tr>
            <tr><td style="opacity:.7;padding:4px 12px">Starting Balance</td><td style="padding:4px 12px">$${startingBalance.toLocaleString()}</td></tr>
            <tr><td style="opacity:.7;padding:4px 12px">Leverage</td><td style="padding:4px 12px">1:100</td></tr>
          </table>
          <p><a href="${url.origin}/trade-terminal-login.html" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:12px">Open Trading Terminal</a></p>
        </div>`,
      });
      await db.from("trade_accounts").update({ credentials_emailed_at: new Date().toISOString() } as any).eq("id", acc.data.id);
    }

    return json({
      ok: true, trade_id: tradeId, password,
      plan: acc.data.plan, starting_balance: startingBalance,
      balance: startingBalance, leverage: 100,
    });
  }

  if (path === "/trade/send-credentials" && method === "POST") {
    const user = await getUserFromRequest(request);
    if (!user) return json({ ok: false, error: "unauthorized" }, { status: 401 });
    const acc = (await db.from("trade_accounts").select("*").eq("user_id", user.id)
      .order("created_at", { ascending: false }).limit(1).maybeSingle()).data as any;
    if (!acc) return json({ ok: false, error: "no_account", message: "No trading account found." }, { status: 404 });
    if (!user.email) return json({ ok: false, error: "no_email", message: "No email on file." }, { status: 400 });
    const r = await sendEmail({
      to: user.email,
      subject: "Your GrowX trading credentials",
      html: `<div style="font-family:Inter,Arial,sans-serif">
        <h2>Your GrowX trading credentials</h2>
        <table style="background:#0b1220;color:#fff;padding:16px;border-radius:12px;font-size:16px">
          <tr><td style="opacity:.7;padding:4px 12px">Trade ID</td><td style="padding:4px 12px"><b>${acc.trade_id}</b></td></tr>
          <tr><td style="opacity:.7;padding:4px 12px">Password</td><td style="padding:4px 12px"><b>${acc.password_plain}</b></td></tr>
          <tr><td style="opacity:.7;padding:4px 12px">Starting Balance</td><td style="padding:4px 12px">$${Number(acc.starting_balance).toLocaleString()}</td></tr>
          <tr><td style="opacity:.7;padding:4px 12px">Leverage</td><td style="padding:4px 12px">1:${acc.leverage}</td></tr>
        </table>
        <p><a href="${url.origin}/trade-terminal-login.html" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:12px">Open Trading Terminal</a></p>
      </div>`,
    });
    if (r.ok) {
      await db.from("trade_accounts").update({ credentials_emailed_at: new Date().toISOString() } as any).eq("id", acc.id);
    }
    return json({ ok: !!r.ok, message: r.ok ? "Credentials sent to " + user.email : "Failed to send email." });
  }

  if (path === "/trade/credentials-status" && method === "GET") {
    const user = await getUserFromRequest(request);
    if (!user) return json({ ok: false }, { status: 401 });
    const acc = (await db.from("trade_accounts").select("credentials_emailed_at")
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle()).data as any;
    return json({ ok: true, delivered: !!(acc && acc.credentials_emailed_at) });
  }

  if (path === "/trade/login" && method === "POST") {
    const b = await readJson(request);
    const tradeId = String(b.trade_id || b.tradeId || "").toUpperCase().trim();
    const password = String(b.password || "");
    const acc = await db.from("trade_accounts").select("*").eq("trade_id", tradeId).maybeSingle();
    if (!acc.data) return json({ ok: false, error: "Invalid credentials" }, { status: 401 });
    const ok = await verifyPassword(password, acc.data.password_hash as string);
    if (!ok) return json({ ok: false, error: "Invalid credentials" }, { status: 401 });
    await db.from("trade_accounts").update({ last_seen_at: new Date().toISOString() }).eq("id", acc.data.id);
    const token = await createTradeSession(acc.data.id as number);
    return json({ ok: true, account: publicAccount(acc.data) },
      { headers: { "Set-Cookie": cookieHeader("gx_trade_session", token) } });
  }
  if (path === "/trade/logout" && method === "POST") {
    return json({ ok: true }, { headers: { "Set-Cookie": clearCookieHeader("gx_trade_session") } });
  }
  if (path === "/trade/account" && method === "GET") {
    const acc = await getTradeAccountFromRequest(request);
    if (!acc) return json({ ok: false }, { status: 401 });
    const positions = await db.from("trade_positions").select("*").eq("trade_account_id", acc.id).order("open_time", { ascending: false });
    const risk = await evaluateRisk(acc, positions.data || []);
    return json({ ok: true, account: publicAccount(risk.account), positions: positions.data || [], risk: risk.summary });
  }
  if (path === "/trade/positions" && method === "POST") {
    const acc = await getTradeAccountFromRequest(request);
    if (!acc) return json({ ok: false }, { status: 401 });
    if (acc.status === "eliminated") return json({ ok: false, error: "Account eliminated — risk limits breached. Purchase a new funded account to continue trading." }, { status: 403 });
    const b = await readJson(request);
    const lots = Math.max(0.01, Number(b.lots || 0.01));
    const price = Number(b.open_price || b.price || 0);
    const leverage = Number(b.leverage || acc.leverage || 100);
    const contract = 100000; // forex standard
    const margin = (lots * contract * price) / leverage / (isFxPair(b.pair) ? 1 : 100);
    const ins = await db.from("trade_positions").insert({
      trade_account_id: acc.id, pair: b.pair, side: b.side === "sell" ? "sell" : "buy",
      lots, leverage, open_price: price, stop_loss: b.stop_loss || null, take_profit: b.take_profit || null,
      margin, status: "open", order_type: b.order_type || "market",
    }).select("*").single();
    await db.from("trade_accounts").update({ used_margin: Number(acc.used_margin) + margin }).eq("id", acc.id);
    return json({ ok: true, position: ins.data });
  }
  if (path.startsWith("/trade/positions/") && path.endsWith("/close") && method === "POST") {
    const acc = await getTradeAccountFromRequest(request);
    if (!acc) return json({ ok: false }, { status: 401 });
    const id = Number(path.split("/")[3]);
    const b = await readJson(request);
    const pos = await db.from("trade_positions").select("*").eq("id", id).eq("trade_account_id", acc.id).single();
    if (!pos.data) return json({ ok: false, error: "not found" }, { status: 404 });
    const closePrice = Number(b.close_price || b.price || 0);
    const pnl = pnlOf(pos.data, closePrice);
    await db.from("trade_positions").update({
      status: "closed", close_price: closePrice, close_time: new Date().toISOString(), realized_pnl: pnl,
    }).eq("id", id);
    await db.from("trade_accounts").update({
      balance: Number(acc.balance) + pnl,
      equity: Number(acc.equity) + pnl,
      used_margin: Math.max(0, Number(acc.used_margin) - Number(pos.data.margin)),
    }).eq("id", acc.id);
    return json({ ok: true, pnl });
  }
  if (path.startsWith("/trade/positions/") && method === "PATCH") {
    const acc = await getTradeAccountFromRequest(request);
    if (!acc) return json({ ok: false }, { status: 401 });
    const id = Number(path.split("/")[3]);
    const b = await readJson(request);
    await db.from("trade_positions").update({
      stop_loss: b.stop_loss ?? null, take_profit: b.take_profit ?? null,
    }).eq("id", id).eq("trade_account_id", acc.id);
    return json({ ok: true });
  }

  // ---------------- CHART CONFIG ----------------
  if (path === "/chart/config" && method === "GET") {
    const key = process.env.REALMARKET_API_KEY || "";
    return json({
      ok: true,
      // Per-symbol WS: wss://api.realmarketapi.com/price?apiKey=KEY&symbolCode=XAUUSD&timeFrame=M1
      ws_base: `wss://api.realmarketapi.com/price`,
      api_key: key,
      has_key: !!key,
    });
  }

  return json({ ok: false, error: "not_found", path }, { status: 404 });
}

function isFxPair(p?: string) {
  if (!p) return true;
  const u = p.toUpperCase();
  return /^[A-Z]{6}$/.test(u) && !u.startsWith("XA");
}
function pnlOf(pos: any, closePrice: number) {
  const contract = 100000;
  const dir = pos.side === "buy" ? 1 : -1;
  return dir * (closePrice - Number(pos.open_price)) * Number(pos.lots) * contract / (isFxPair(pos.pair) ? 1 : 1000);
}
function publicAccount(a: any) {
  return {
    id: a.id, trade_id: a.trade_id, plan: a.plan, balance: Number(a.balance),
    equity: Number(a.equity), used_margin: Number(a.used_margin),
    starting_balance: Number(a.starting_balance), leverage: a.leverage, status: a.status,
  };
}

export const Route = createFileRoute("/api/$")({
  server: {
    handlers: {
      GET:    async ({ request, params }) => handle(request, params),
      POST:   async ({ request, params }) => handle(request, params),
      PATCH:  async ({ request, params }) => handle(request, params),
      DELETE: async ({ request, params }) => handle(request, params),
    },
  },
});
