import os, json, time, requests

BOT_TOKEN = "8932261850:AAG4791Hk4YxFtvISzoot_cKvcfok49snRI"
ADMIN_IDS = ["7797816241"]
MINI_APP_URL = "https://pnt-tiger.github.io/EarnHub/"
DATA_FILE = os.path.join(os.path.dirname(__file__), "earnhub_data.json")

users_db = {}
tasks_db = []

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

def send_msg(chat_id, text, markup=None):
    data = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    if markup:
        data["reply_markup"] = json.dumps(markup)
    try:
        return requests.post(f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage", json=data, timeout=10).json()
    except: return None

def edit_msg(chat_id, msg_id, text, markup=None):
    data = {"chat_id": chat_id, "message_id": msg_id, "text": text, "parse_mode": "HTML"}
    if markup:
        data["reply_markup"] = json.dumps(markup)
    try:
        return requests.post(f"https://api.telegram.org/bot{BOT_TOKEN}/editMessageText", json=data, timeout=10).json()
    except: return None

def answer_cb(cb_id, text=""):
    try:
        requests.post(f"https://api.telegram.org/bot{BOT_TOKEN}/answerCallbackQuery",
            json={"callback_query_id": cb_id, "text": text, "show_alert": False}, timeout=5)
    except: pass

load_data()
print("Bot started!")

# Store admin states: {chat_id: {"action": "broadcast|select_user", "state": "awaiting_msg", "target": None}}
admin_states = {}

last_update_id = 0
while True:
    try:
        url = f"https://api.telegram.org/bot{BOT_TOKEN}/getUpdates"
        params = {"offset": last_update_id + 1, "timeout": 30}
        r = requests.get(url, params=params, timeout=35)
        data = r.json()
        if not data.get("ok"):
            time.sleep(3); continue

        for update in data.get("result", []):
            last_update_id = update["update_id"]

            # ---- CALLBACK QUERY ----
            cb = update.get("callback_query")
            if cb:
                cb_data = cb.get("data", "")
                cb_id = cb["id"]
                cid = str(cb["message"]["chat"]["id"])
                mid = cb["message"]["message_id"]

                if cid not in ADMIN_IDS:
                    answer_cb(cb_id, "Access denied")
                    continue

                if cb_data == "admin_panel":
                    answer_cb(cb_id)
                    markup = {
                        "inline_keyboard": [
                            [{"text": "📢 Broadcast to All Users", "callback_data": "admin_broadcast"}],
                            [{"text": "👥 View All Users", "callback_data": "admin_list_users"}],
                            [{"text": "💬 Send to Specific User", "callback_data": "admin_select_user"}],
                            [{"text": "🔙 Close", "callback_data": "admin_close"}]
                        ]
                    }
                    edit_msg(cid, mid, "⚙️ <b>Admin Panel</b>\n\nChoose an option:", markup)

                elif cb_data == "admin_broadcast":
                    answer_cb(cb_id, "Send your message now")
                    admin_states[cid] = {"action": "broadcast"}
                    edit_msg(cid, mid,
                        "📢 <b>Broadcast to All Users</b>\n\n"
                        "Send the message you want to broadcast to ALL users.\n\n"
                        "Type your message below and send it as a normal message.\n"
                        "Or click Cancel to go back.",
                        {"inline_keyboard": [[{"text": "🔙 Cancel", "callback_data": "admin_panel"}]]}
                    )

                elif cb_data == "admin_list_users":
                    answer_cb(cb_id)
                    if not users_db:
                        edit_msg(cid, mid, "👥 No users registered yet.", {"inline_keyboard": [[{"text": "🔙 Back", "callback_data": "admin_panel"}]]})
                    else:
                        lines = ["👥 <b>All Users:</b>\n"]
                        for uid, u in sorted(users_db.items(), key=lambda x: x[1].get("balance", 0), reverse=True):
                            name = u.get("first_name", "?") or u.get("telegram_username", "?")
                            bal = u.get("balance", 0)
                            ref = u.get("referral_code", "")
                            lines.append(f"• {name} (@{u.get('telegram_username','')})")
                            lines.append(f"  ID: <code>{uid}</code> | 💰 ${bal:.2f} | Ref: {ref}")
                        text = "\n".join(lines)
                        # Split if too long
                        if len(text) > 4000:
                            text = text[:4000] + "\n\n... (truncated)"
                        edit_msg(cid, mid, text, {"inline_keyboard": [[{"text": "🔙 Back", "callback_data": "admin_panel"}]]})

                elif cb_data == "admin_select_user":
                    answer_cb(cb_id)
                    lines = ["💬 <b>Send to Specific User</b>\n\nChoose a user or send their chat ID:\n"]
                    for uid, u in list(users_db.items())[:30]:
                        name = u.get("first_name", "?") or u.get("telegram_username", "?")
                        lines.append(f"• <code>{uid}</code> - {name}")
                    text = "\n".join(lines)
                    if len(text) > 4000:
                        text = text[:4000] + "\n\n... (truncated)"
                    admin_states[cid] = {"action": "select_user"}
                    edit_msg(cid, mid,
                        text + "\n\nSend the chat ID of the user you want to message:",
                        {"inline_keyboard": [[{"text": "🔙 Cancel", "callback_data": "admin_panel"}]]}
                    )

                elif cb_data == "admin_close":
                    answer_cb(cb_id, "Closed")
                    try:
                        requests.post(f"https://api.telegram.org/bot{BOT_TOKEN}/deleteMessage",
                            json={"chat_id": cid, "message_id": mid}, timeout=5)
                    except: pass

                continue

            # ---- REGULAR MESSAGES ----
            msg = update.get("message")
            if not msg: continue
            chat_id = str(msg["chat"]["id"])
            text = msg.get("text", "")
            user = msg.get("from", {})

            # ---- ADMIN MESSAGE HANDLING ----
            if chat_id in ADMIN_IDS and chat_id in admin_states:
                state = admin_states[chat_id]

                if state["action"] == "broadcast":
                    if text:
                        success = 0
                        fail = 0
                        for uid in users_db:
                            if send_msg(uid, f"📢 <b>Admin Broadcast</b>\n\n{text}"):
                                success += 1
                            else:
                                fail += 1
                            time.sleep(0.05)
                        send_msg(chat_id, f"✅ Broadcast sent!\n✓ Delivered: {success}\n✗ Failed: {fail}")
                    del admin_states[chat_id]
                    continue

                elif state["action"] == "select_user":
                    target_id = text.strip()
                    if target_id in users_db:
                        admin_states[chat_id] = {"action": "msg_user", "target": target_id}
                        u = users_db[target_id]
                        send_msg(chat_id,
                            f"✅ Selected: {u.get('first_name','?')} (@{u.get('telegram_username','')})\n"
                            f"Balance: ${u.get('balance',0):.2f}\n\n"
                            f"Now send the message for this user:",
                            {"inline_keyboard": [[{"text": "🔙 Cancel", "callback_data": "admin_panel"}]]}
                        )
                    else:
                        send_msg(chat_id, "❌ User not found! Send a valid chat ID from the list above.")
                    continue

                elif state["action"] == "msg_user":
                    target = state.get("target")
                    if target and text:
                        u = users_db.get(target)
                        name = u.get("first_name", "User") if u else "User"
                        ok = send_msg(target, f"💬 <b>Message from Admin</b>\n\n{text}")
                        if ok:
                            send_msg(chat_id, f"✅ Message sent to {name} (ID: {target})")
                        else:
                            send_msg(chat_id, f"❌ Failed to send to {target}")
                    del admin_states[chat_id]
                    continue

            # ---- /START ----
            if text == "/start" or text.startswith("/start "):
                args = text.replace("/start", "").strip()
                is_new = False

                if chat_id not in users_db:
                    is_new = True
                    users_db[chat_id] = {
                        "chat_id": msg["chat"]["id"],
                        "telegram_username": user.get("username") or user.get("first_name", ""),
                        "first_name": user.get("first_name", ""),
                        "username": f"tg_{user['id']}",
                        "password": f"pass_{user['id']}",
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

                name = user.get("first_name", "User")
                if is_new:
                    response = (
                        f"✨ <b>Welcome to EarnHub, {name}!</b> ✨\n\n"
                        f"🎉 <b>Welcome Bonus: +0.01 USDT</b> added!\n\n"
                        f"📌 Complete tasks & earn USDT\n"
                        f"💰 Min withdraw: $1 USDT (BEP20)\n"
                        f"👥 Invite friends = 10% commission\n\n"
                        f"👇 Click below to start earning!"
                    )
                else:
                    response = f"👋 <b>Welcome to EarnHub, {name}!</b>"

                markup = {
                    "inline_keyboard": [
                        [{"text": "🚀 Open Mini App", "url": MINI_APP_URL}]
                    ]
                }
                send_msg(chat_id, response, markup)

            # ---- /ADMIN ----
            elif text == "/admin" and chat_id in ADMIN_IDS:
                markup = {
                    "inline_keyboard": [
                        [{"text": "📢 Broadcast to All Users", "callback_data": "admin_broadcast"}],
                        [{"text": "👥 View All Users", "callback_data": "admin_list_users"}],
                        [{"text": "💬 Send to Specific User", "callback_data": "admin_select_user"}],
                        [{"text": "🔙 Close", "callback_data": "admin_close"}]
                    ]
                }
                send_msg(chat_id, "⚙️ <b>Admin Panel</b>\n\nChoose an option:", markup)

    except Exception as e:
        print(f"Error: {e}")
        time.sleep(5)
