const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const express = require('express');

// 🔴 THAY TOKEN BOT CỦA BẠN VÀO ĐÂY
const token = '8591949878:AAFxodvzGVEEutXeJ16YP2Ap1raNX8iPdZ8';
const bot = new TelegramBot(token, { polling: true });

const apiBaseUrl = "https://script.google.com/macros/s/AKfycbzgfK1VP8ivsAbNRLdne48XD-7QcwsxdHP47JaLpNdKxN7jVaEuDqZMSkCDSYiT6iwc/exec";

// 🔴 ID ADMIN ĐỂ NHẬN THÔNG BÁO VÀ QUYỀN DỪNG LỆNH
const ADMIN_ID = '7932302530'; 
const BOT_PASSWORD = '2909';

// Lưu trạng thái chạy và xác thực
const activeHunts = {};
const authenticatedUsers = {};

// 🟢 TẠO SERVER GIẢ ĐỂ RENDER KHÔNG BÁO LỖI
const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot đang hoạt động 24/7!'));
app.listen(port, () => console.log(`Server giả đang chạy trên port ${port}`));

// Hàm sinh số điện thoại ngẫu nhiên
function randomPhone() {
    const mid = Math.floor(Math.random() * 90000000) + 10000000;
    return `09${mid}`;
}

// Hàm suy ra năm sinh
function getYearOfBirth(className) {
    const classNumber = parseInt(className.replace(/\D/g, ""));
    if (isNaN(classNumber)) return "2011";
    return (2020 - classNumber).toString();
}

// Xử lý tin nhắn văn bản (Mật khẩu & Lệnh Admin)
bot.on('message', (msg) => {
    const chatId = msg.chat.id.toString();
    const text = msg.text;

    if (!text) return;

    // Lệnh Admin /stop
    if (text.startsWith('/stop') && chatId === ADMIN_ID) {
        const targetId = text.replace('/stop', '').trim();
        if (activeHunts[targetId]) {
            activeHunts[targetId] = false;
            bot.sendMessage(ADMIN_ID, `✅ Đã dừng tiến trình của ID: \`${targetId}\`.`, { parse_mode: "Markdown" });
            bot.sendMessage(targetId, `🛑 Admin đã can thiệp và dừng quá trình của bạn.`, { parse_mode: "Markdown" });
        }
        return;
    }

    // Kiểm tra mật khẩu (Chỉ xử lý nếu người dùng chưa xác thực và gửi đúng pass)
    if (!authenticatedUsers[chatId] && text === BOT_PASSWORD) {
        authenticatedUsers[chatId] = true;
        bot.sendMessage(chatId, "🔓 Xác thực thành công! Giờ bạn có thể sử dụng chế độ **Vô hạn**. Hãy nhấn /start để chọn lại.", { parse_mode: "Markdown" });
    }
});

// Lệnh /start - Không cần pass nữa
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id.toString();
    const keyboard = [];
    
    for (let i = 1; i <= 9; i += 3) {
        keyboard.push([
            { text: `Lớp ${i}`, callback_data: `class_Lớp ${i}` },
            { text: `Lớp ${i+1}`, callback_data: `class_Lớp ${i+1}` },
            { text: `Lớp ${i+2}`, callback_data: `class_Lớp ${i+2}` }
        ]);
    }
    keyboard.push([{ text: `Lớp 10`, callback_data: `class_Lớp 10` }, { text: `Lớp 11`, callback_data: `class_Lớp 11` }]);

    bot.sendMessage(chatId, "👋 Chào mừng!\n\n⚠️ Hiện tại bên Hocmai lớp 1,2,3,4,5,6,7,8,9,10 và 11 đã hết quà.\n\nVui lòng chọn Lớp để bắt đầu:\n\n💬 _Hỗ trợ: @ngkhoa1916_", {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: keyboard }
    });
});

// Xử lý các nút bấm
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id.toString();
    const messageId = query.message.message_id;
    const data = query.data;

    if (data.startsWith('class_')) {
        const selectedClass = data.split('_')[1];
        const giftKeyboard = [
            [{ text: "🎓 Khóa Học", callback_data: `qty_khoahoc_${selectedClass}` }],
            [{ text: "📝 Phòng Luyện", callback_data: `qty_phongluyen_${selectedClass}` }],
            [{ text: "🎁 Bất kỳ", callback_data: `qty_any_${selectedClass}` }]
        ];
        bot.editMessageText(`Bạn đã chọn **${selectedClass}**. Bạn muốn săn quà gì?`, {
            chat_id: chatId, message_id: messageId, parse_mode: "Markdown", reply_markup: { inline_keyboard: giftKeyboard }
        });
    }

    if (data.startsWith('qty_')) {
        const parts = data.split('_');
        const targetGift = parts[1];
        const className = parts[2];
        const qtyKeyboard = [
            [{ text: "1 Mã", callback_data: `hunt_${targetGift}_${className}_1` }, { text: "3 Mã", callback_data: `hunt_${targetGift}_${className}_3` }],
            [{ text: "5 Mã", callback_data: `hunt_${targetGift}_${className}_5` }, { text: "Vô hạn ♾️ (cần mật khẩu)", callback_data: `hunt_${targetGift}_${className}_0` }]
        ];
        bot.editMessageText(`Bạn muốn lấy bao nhiêu mã?`, {
            chat_id: chatId, message_id: messageId, parse_mode: "Markdown", reply_markup: { inline_keyboard: qtyKeyboard }
        });
    }

    if (data.startsWith('hunt_')) {
        const parts = data.split('_');
        const targetGift = parts[1];
        const className = parts[2];
        const quantity = parseInt(parts[3], 10);

        // KIỂM TRA PASS NẾU CHỌN VÔ HẠN (quantity === 0)
        if (quantity === 0 && !authenticatedUsers[chatId]) {
            bot.answerCallbackQuery(query.id, { text: "🔑 Chế độ này yêu cầu mật khẩu!", show_alert: true });
            return bot.sendMessage(chatId, "🔐 Đây là tính năng nâng cao. Vui lòng nhập mật khẩu vào ô chat để mở khóa:");
        }
        
        const userInfo = query.from.username ? `@${query.from.username}` : query.from.first_name;
        const qtyText = quantity === 0 ? "Vô hạn" : quantity + " mã";
        
        bot.sendMessage(ADMIN_ID, `👀 **Theo dõi:** ${userInfo} (ID: \`${chatId}\`) đang săn **${qtyText} ${targetGift}** - **${className}**.`, { parse_mode: "Markdown" });

        activeHunts[chatId] = true;
        bot.editMessageText(`⏳ Đang bắt đầu săn **${qtyText} ${targetGift}** cho **${className}**...`, { 
            chat_id: chatId, message_id: messageId, parse_mode: "Markdown",
            reply_markup: { inline_keyboard: [[{ text: "❌ Hủy quá trình", callback_data: "cancel_hunt" }]] }
        });
        
        await huntGiftLoop(chatId, className, targetGift, quantity, messageId);
    }

    if (data === 'cancel_hunt' && activeHunts[chatId]) {
        activeHunts[chatId] = false;
        bot.editMessageText("🛑 Đang tiến hành hủy lệnh...", { chat_id: chatId, message_id: messageId });
    }
});

async function huntGiftLoop(chatId, className, targetGift, quantity, originalMessageId) {
    let attempts = 0;
    let foundCount = 0;
    const isInfinite = quantity === 0;
    const maxAttempts = isInfinite ? 999999 : quantity * 50; 

    while (attempts < maxAttempts && (isInfinite || foundCount < quantity)) {
        if (!activeHunts[chatId]) {
            bot.editMessageText(`🛑 Quá trình săn quà đã dừng. Thu thập được **${foundCount}** mã.`, { 
                chat_id: chatId, message_id: originalMessageId, parse_mode: "Markdown" 
            });
            return;
        }

        attempts++;
        const playPhone = randomPhone();
        const birthYear = getYearOfBirth(className);

        try {
            const response = await axios.get(apiBaseUrl, { 
                params: { action: "get_gift", name: "Auto Bot", age: birthYear, phone: playPhone, email: `bot${Date.now()}@gmail.com`, class: className }
            });
            const data = response.data;

            if (data.gift && data.gift.Gift_Title) {
                const titleLower = data.gift.Gift_Title.toLowerCase();
                const nameLower = (data.gift.Gift_Name || "").toLowerCase();
                const isVoucher = titleLower.includes('voucher') || nameLower.includes('voucher');

                let isMatch = false;
                if (targetGift === 'any') isMatch = true;
                else if (targetGift === 'khoahoc' && !isVoucher && titleLower.includes('khóa')) isMatch = true;
                else if (targetGift === 'phongluyen' && !isVoucher && titleLower.includes('phòng luyện')) isMatch = true;

                if (isMatch) {
                    foundCount++;
                    bot.sendMessage(chatId, `🎉 **THÀNH CÔNG (${foundCount})**\n📱 SĐT: \`${playPhone}\`\n🎁: **${data.gift.Gift_Title}**\n🔑: \`${data.gift.Gift_Code || 'N/A'}\``, { parse_mode: "Markdown" });
                    
                    if (!isInfinite && foundCount >= quantity) {
                        bot.editMessageText(`✅ Đã thu thập đủ **${quantity} mã**.\n👉 Kích hoạt: https://hocmai.vn/course/mycourse2.php?t=activationkey\n⚠️ Đợi 15p-1h nếu bị báo quá lượt.\n💬 Admin: @ngkhoa1916`, { 
                            chat_id: chatId, message_id: originalMessageId, disable_web_page_preview: true, parse_mode: "Markdown" 
                        });
                        delete activeHunts[chatId];
                        return;
                    }
                }
            }
        } catch (e) { console.log("Lỗi mạng..."); }
        await new Promise(r => setTimeout(r, 1000));
    }

    if (activeHunts[chatId]) {
        bot.editMessageText(`❌ Hết lượt thử! Lấy được **${foundCount}** mã.\n💬 Hỗ trợ: @ngkhoa1916`, { 
            chat_id: chatId, message_id: originalMessageId, parse_mode: "Markdown" 
        });
    }
    delete activeHunts[chatId];
}

console.log("🤖 Bot khởi động thành công!");





