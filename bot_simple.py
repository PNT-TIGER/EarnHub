import os, json, time, requests, sys
from threading import Thread

BOT_TOKEN = "8932261850:AAG4791Hk4YxFtvISzoot_cKvcfok49snRI"
ADMIN_IDS = ["7797816241"]
MINI_APP_URL = "https://pnt-tiger.github.io/EarnHub/"
DATA_FILE = os.path.join(os.path.dirname(__file__), "earnhub_data.json")

users_db = {}
tasks_db = []
admin_states = {}

def load_data():
    global users_db, tasks_db
    try:
        with open(DATA_FILE) as f:
            d = json.load(f)
            users_db = d.get("users", {})
            tasks_db = d.get("tasks", [])
    except: pass

def save_data():
    with open(DATA_FILE, "w") as f:
        json.dump({"users": users_db, "tasks": tasks_db}, f)

def api(method, **kwargs):
    try:
        r = requests.post(f"https://api.telegram.org/bot{BOT_TOKEN}/{method}",
            json=kwargs, timeout=15)
        return r.json()
    except: return None

load_data()
print("Bot running!", flush=True)

last_id = 0
while True:
    try:
        r = requests.get(f"https://api.telegram.org/bot{BOT_TOKEN}/getUpdates",
            params={"offset": last_id + 1, "timeout": 10}, timeout=15)
        data = r.json()
        if not data.get("ok"): continue

        for upd in data.get("result", []):
            last_id = upd["update_id"]

            # Callback
            cb = upd.get("callback_query")
            if cb:
                cid = str(cb["message"]["chat"]["id"])
                dta = cb["data"]
                mid = cb["message"]["message_id"]
                if cid not in ADMIN_IDS:
                    api("answerCallbackQuery", callback_query_id=cb["id"])
                    continue

                if dta == "admin_panel":
                    api("editMessageText", chat_id=cid, message_id=mid,
                        text="⚙️ <b>Admin Panel</b>", parse_mode="HTML",
                        reply_markup=json.dumps({"inline_keyboard": [
                            [{"text": "📢 Broadcast", "callback_data": "admin_broadcast"}],
                            [{"text": "👥 All Users", "callback_data": "admin_list"}],
                            [{"text": "💬 Send to User", "callback_data": "admin_send"}],
                            [{"text": "🔙 Close", "callback_data": "admin_close"}]
                        ]}))
                elif dta == "admin_list":
                    lines = ["👥 <b>All Users:</b>\n"]
                    for uid, u in users_db.items():
                        lines.append(f"• {u.get('first_name','?')} (@{u.get('telegram_username','')})")
                        lines.append(f"  ID: <code>{uid}</code> | 💰 ${u.get('balance',0):.2f}")
                    text = "\n".join(lines)[:4000]
                    api("editMessageText", chat_id=cid, message_id=mid,
                        text=text, parse_mode="HTML",
                        reply_markup=json.dumps({"inline_keyboard": [[{"text":"🔙 Back","callback_data":"admin_panel"}]]}))
                elif dta == "admin_broadcast":
                    admin_states[cid] = "broadcast"
                    api("editMessageText", chat_id=cid, message_id=mid,
                        text="📢 Send your broadcast message now:",
                        reply_markup=json.dumps({"inline_keyboard": [[{"text":"🔙 Cancel","callback_data":"admin_panel"}]]}))
                elif dta == "admin_send":
                    admin_states[cid] = "send_user"
                    lines = ["💬 Send the user's Chat ID:\n"]
                    for uid, u in list(users_db.items())[:15]:
                        lines.append(f"<code>{uid}</code> - {u.get('first_name','?')}")
                    api("editMessageText", chat_id=cid, message_id=mid,
                        text="\n".join(lines)[:4000], parse_mode="HTML",
                        reply_markup=json.dumps({"inline_keyboard": [[{"text":"🔙 Cancel","callback_data":"admin_panel"}]]}))
                elif dta == "admin_close":
                    api("deleteMessage", chat_id=cid, message_id=mid)
                api("answerCallbackQuery", callback_query_id=cb["id"])
                continue

            # Message
            msg = upd.get("message")
            if not msg: continue
            chat_id = str(msg["chat"]["id"])
            text = msg.get("text", "")
            user = msg.get("from", {})

            # Admin state handling
            if chat_id in ADMIN_IDS and chat_id in admin_states:
                state = admin_states.pop(chat_id)
                if state == "broadcast" and text:
                    ok = 0
                    for uid in users_db:
                        if api("sendMessage", chat_id=uid,
                            text=f"📢 <b>Admin Broadcast</b>\n\n{text}", parse_mode="HTML"):
                            ok += 1
                        time.sleep(0.05)
                    api("sendMessage", chat_id=chat_id,
                        text=f"✅ Broadcast sent to {ok}/{len(users_db)} users")
                elif state == "send_user" and text:
                    target = text.strip()
                    if target in users_db:
                        admin_states[chat_id] = ("send_msg", target)
                        u = users_db[target]
                        api("sendMessage", chat_id=chat_id,
                            text=f"✅ Selected {u.get('first_name','?')}\nNow send the message:",
                            reply_markup=json.dumps({"inline_keyboard":[[{"text":"🔙 Cancel","callback_data":"admin_panel"}]]}))
                    else:
                        api("sendMessage", chat_id=chat_id,
                            text="❌ User not found! Send a valid Chat ID.")
                elif isinstance(admin_states.get(chat_id), tuple) and admin_states[chat_id][0] == "send_msg":
                    target = admin_states.pop(chat_id)[1]
                    if api("sendMessage", chat_id=target,
                        text=f"💬 <b>Message from Admin</b>\n\n{text}", parse_mode="HTML"):
                        api("sendMessage", chat_id=chat_id, text="✅ Sent!")
                    else:
                        api("sendMessage", chat_id=chat_id, text="❌ Failed")
                continue

            # /start
            if text == "/start" or text.startswith("/start "):
                args = text.replace("/start", "").strip()
                is_new = chat_id not in users_db
                if is_new:
                    users_db[chat_id] = {
                        "chat_id": msg["chat"]["id"],
                        "telegram_username": user.get("username") or user.get("first_name", ""),
                        "first_name": user.get("first_name", ""),
                        "balance": 0.01,
                        "referral_code": str(user["id"]),
                        "referred_by": "",
                        "completed_tasks": [],
                        "claimed_tasks": [],
                        "task_screenshots": {},
                        "created_at": str(msg.get("date", "")),
                    }
                    if args and args.isdigit():
                        for uid, u in users_db.items():
                            if u.get("referral_code") == args and uid != chat_id:
                                users_db[chat_id]["referred_by"] = uid
                                u["balance"] = u.get("balance", 0) + 0.1
                                break
                    save_data()
                    api("sendMessage", chat_id=chat_id,
                        text=f"✨ <b>Welcome to EarnHub, {user.get('first_name','User')}!</b> ✨\n\n🎉 <b>+0.01 USDT</b> Welcome Bonus added!\n\n👇 Open Mini App:",
                        parse_mode="HTML",
                        reply_markup=json.dumps({"inline_keyboard":[[{"text":"🚀 Open Mini App","web_app":{"url":MINI_APP_URL}}]]}))
                else:
                    api("sendMessage", chat_id=chat_id,
                        text=f"👋 <b>Welcome to EarnHub, {user.get('first_name','User')}!</b>",
                        parse_mode="HTML",
                        reply_markup=json.dumps({"inline_keyboard":[[{"text":"🚀 Open Mini App","web_app":{"url":MINI_APP_URL}}]]}))

            # /admin
            elif text == "/admin" and chat_id in ADMIN_IDS:
                api("sendMessage", chat_id=chat_id,
                    text="⚙️ <b>Admin Panel</b>", parse_mode="HTML",
                    reply_markup=json.dumps({"inline_keyboard": [
                        [{"text": "📢 Broadcast", "callback_data": "admin_broadcast"}],
                        [{"text": "👥 All Users", "callback_data": "admin_list"}],
                        [{"text": "💬 Send to User", "callback_data": "admin_send"}],
                        [{"text": "🔙 Close", "callback_data": "admin_close"}]
                    ]}))

    except Exception as e:
        print(f"Error: {e}", flush=True)
        time.sleep(3)
