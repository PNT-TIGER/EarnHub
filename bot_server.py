"""
EarnHub Telegram Bot Server
Deploy on Render.com, PythonAnywhere, or any VPS

Setup:
  pip install python-telegram-bot requests
  python bot_server.py
"""
import os
import json
import requests
import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, MessageHandler, filters, ContextTypes

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BOT_TOKEN = os.environ.get("BOT_TOKEN", "8932261850:AAFDn7uS5yNkSVTWQ6b4_B-1y3lK-37y3ME")
ADMIN_IDS = [int(os.environ.get("ADMIN_CHAT_ID", "7797816241"))]
MINI_APP_URL = os.environ.get("MINI_APP_URL", "https://pnt-tiger.github.io/EarnHub/")

users_db = {}
tasks_db = []
pending_reviews = {}

DATA_FILE = "earnhub_data.json"

def load_data():
    global users_db, tasks_db, pending_reviews
    try:
        with open(DATA_FILE) as f:
            d = json.load(f)
            users_db = d.get("users", {})
            tasks_db = d.get("tasks", [])
            pending_reviews = d.get("reviews", {})
    except: pass

def save_data():
    with open(DATA_FILE, "w") as f:
        json.dump({"users": users_db, "tasks": tasks_db, "reviews": pending_reviews}, f)

load_data()

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    chat_id = update.effective_chat.id
    args = context.args

    ref_code = args[0] if args else None

    if str(chat_id) not in users_db:
        users_db[str(chat_id)] = {
            "chat_id": chat_id,
            "telegram_username": user.username or user.first_name,
            "first_name": user.first_name,
            "username": f"tg_{user.id}",
            "password": f"pass_{user.id}",
            "balance": 0,
            "referral_code": f"REF{user.id}",
            "referred_by": "",
            "completed_tasks": [],
            "claimed_tasks": [],
            "task_screenshots": {},
            "created_at": str(update.message.date) if update.message else "",
        }
        if ref_code:
            for uid, u in users_db.items():
                if u.get("referral_code") == ref_code and uid != str(chat_id):
                    users_db[str(chat_id)]["referred_by"] = uid
                    u["balance"] = u.get("balance", 0) + 0.1
                    break
        save_data()
        msg = f"Welcome {user.first_name}! Your account is ready.\nReferral Code: REF{user.id}"
    else:
        msg = f"Welcome back {user.first_name}!"

    keyboard = [[InlineKeyboardButton("Open EarnHub", url=MINI_APP_URL)]]
    if ref_code:
        keyboard.append([InlineKeyboardButton("Open with Referral", url=f"{MINI_APP_URL}?ref={ref_code}")])

    await update.message.reply_text(
        f"{msg}\n\nClick below to open the app:",
        reply_markup=InlineKeyboardMarkup(keyboard)
    )

async def admin_stats(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_chat.id not in ADMIN_IDS:
        return
    total_users = len(users_db)
    total_balance = sum(u.get("balance", 0) for u in users_db.values())
    pending = sum(1 for r in pending_reviews.values() if r.get("status") == "pending")
    msg = (
        f"📊 EarnHub Stats\n"
        f"👥 Users: {total_users}\n"
        f"💰 Total Balance: ${total_balance:.2f}\n"
        f"📸 Pending Reviews: {pending}\n"
        f"📋 Tasks: {len(tasks_db)}"
    )
    await update.message.reply_text(msg)

async def admin_users(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_chat.id not in ADMIN_IDS:
        return
    if not users_db:
        await update.message.reply_text("No users yet.")
        return
    msg = "👥 Users:\n\n"
    for uid, u in list(users_db.items())[:20]:
        msg += f"• {u.get('username')} ({u.get('telegram_username')}) - ${u.get('balance', 0):.2f}\n"
    await update.message.reply_text(msg)

async def admin_addtask(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_chat.id not in ADMIN_IDS:
        return
    if len(context.args) < 2:
        await update.message.reply_text("Usage: /addtask Title | Link | Description | Reward")
        return
    text = " ".join(context.args)
    parts = [p.strip() for p in text.split("|")]
    if len(parts) < 2:
        await update.message.reply_text("Format: /addtask Title | Link | Description | Reward")
        return
    task = {
        "id": f"t{len(tasks_db)+1}_{os.urandom(3).hex()}",
        "title": parts[0],
        "link": parts[1] if len(parts) > 1 else "",
        "description": parts[2] if len(parts) > 2 else "",
        "reward": float(parts[3]) if len(parts) > 3 and parts[3].replace(".","").isdigit() else 0.5,
        "active": True,
        "createdAt": str(update.message.date)
    }
    tasks_db.append(task)
    save_data()
    # Broadcast to mini app
    broadcast_to_miniapp()
    await update.message.reply_text(f"✅ Task added: {task['title']} - {task['reward']} USDT")

async def admin_tasks(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_chat.id not in ADMIN_IDS:
        return
    if not tasks_db:
        await update.message.reply_text("No tasks.")
        return
    msg = "📋 Tasks:\n\n"
    for t in tasks_db[-10:]:
        msg += f"• {t['title']} - {t['reward']} USDT ({'Active' if t.get('active') else 'Inactive'})\n"
    await update.message.reply_text(msg)

async def admin_reviews(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_chat.id not in ADMIN_IDS:
        return
    pending = {k: v for k, v in pending_reviews.items() if v.get("status") == "pending"}
    if not pending:
        await update.message.reply_text("No pending reviews.")
        return
    for uid, rev in pending.items():
        user = users_db.get(uid, {})
        keyboard = [
            [InlineKeyboardButton("✅ Approve", callback_data=f"approve_{uid}_{rev.get('taskId','')}"),
             InlineKeyboardButton("❌ Reject", callback_data=f"reject_{uid}_{rev.get('taskId','')}")]
        ]
        await update.message.reply_text(
            f"📸 Pending Review\nUser: {user.get('username','?')}\nTask: {rev.get('taskTitle','?')}",
            reply_markup=InlineKeyboardMarkup(keyboard)
        )

async def button_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    data = query.data
    parts = data.split("_")
    action = parts[0]
    uid = parts[1] if len(parts) > 1 else ""
    task_id = parts[2] if len(parts) > 2 else ""

    if action == "approve":
        if uid in pending_reviews:
            pending_reviews[uid]["status"] = "approved"
            if uid in users_db:
                users_db[uid]["balance"] = users_db[uid].get("balance", 0) + pending_reviews[uid].get("reward", 0)
                if "claimed_tasks" not in users_db[uid]:
                    users_db[uid]["claimed_tasks"] = []
                if task_id not in users_db[uid]["claimed_tasks"]:
                    users_db[uid]["claimed_tasks"].append(task_id)
                if "task_screenshots" not in users_db[uid]:
                    users_db[uid]["task_screenshots"] = {}
                if task_id in users_db[uid]["task_screenshots"]:
                    if isinstance(users_db[uid]["task_screenshots"][task_id], dict):
                        users_db[uid]["task_screenshots"][task_id]["status"] = "approved"
            save_data()
            broadcast_to_miniapp()
            await query.edit_message_text(f"✅ Approved! Reward added to user.")
            try:
                await context.bot.send_message(chat_id=uid, text=f"✅ Your task screenshot was approved! +${pending_reviews[uid].get('reward',0):.2f} USDT added to your balance.")
            except: pass

    elif action == "reject":
        if uid in pending_reviews:
            pending_reviews[uid]["status"] = "rejected"
            if uid in users_db and "task_screenshots" in users_db[uid] and task_id in users_db[uid]["task_screenshots"]:
                if isinstance(users_db[uid]["task_screenshots"][task_id], dict):
                    users_db[uid]["task_screenshots"][task_id]["status"] = "rejected"
            save_data()
            await query.edit_message_text(f"❌ Screenshot rejected. User can resubmit.")
            try:
                await context.bot.send_message(chat_id=uid, text="❌ Your task screenshot was rejected. Please submit a clearer screenshot.")
            except: pass

async def unknown(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("Use /start to open EarnHub")

def broadcast_to_miniapp():
    data = json.dumps({
        "type": "earnhub_sync",
        "tasks": tasks_db,
        "time": __import__('time').time()
    })
    for admin_id in ADMIN_IDS:
        try:
            requests.post(
                f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage",
                json={"chat_id": admin_id, "text": "📦 SYNC:" + data}
            )
        except: pass

def main():
    app = Application.builder().token(BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("stats", admin_stats))
    app.add_handler(CommandHandler("users", admin_users))
    app.add_handler(CommandHandler("addtask", admin_addtask))
    app.add_handler(CommandHandler("tasks", admin_tasks))
    app.add_handler(CommandHandler("reviews", admin_reviews))
    app.add_handler(CallbackQueryHandler(button_callback))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, unknown))

    logger.info("Bot started! Press Ctrl+C to stop.")
    app.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == "__main__":
    main()
