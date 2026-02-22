const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const express = require('express');

// 🔴 THAY TOKEN BOT CỦA BẠN VÀO ĐÂY
const token = '8591949878:AAFxodvzGVEEutXeJ16YP2Ap1raNX8iPdZ8';
const bot = new TelegramBot(token, { polling: true });

const apiBaseUrl = "https://script.google.com/macros/s/AKfycbzgfK1VP8ivsAbNRLdne48XD-7QcwsxdHP47JaLpNdKxN7jVaEuDqZMSkCDSYiT6iwc/exec";

// 🔴 ID ADMIN ĐỂ NHẬN THÔNG BÁO VÀ QUYỀN DỪNG LỆNH
const ADMIN_ID = '7932302530'; 

// Lưu trạng thái chạy của mỗi user
const activeHunts = {};

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

// Lệnh dành cho Admin để dừng tiến trình của một User bất kỳ
bot.onText(/\/stop (.+)/, (msg, match) => {
    const chatId = msg.chat.id.toString();
    const targetId = match[1].trim();

    if (chatId !== ADMIN_ID) return; // Chỉ admin mới được dùng

    if (activeHunts[targetId]) {
        activeHunts[targetId] = false;
        bot.sendMessage(ADMIN_ID, `✅ Đã phát lệnh dừng tiến trình của ID: \`${targetId}\`.`, { parse_mode: "Markdown" });
        bot.sendMessage(targetId, `🛑 Quá trình săn quà của bạn đã bị Admin tạm dừng.`, { parse_mode: "Markdown" });
    } else {
        bot.sendMessage(ADMIN_ID, `⚠️ ID \`${targetId}\` hiện không có tiến trình nào đang chạy.`, { parse_mode: "Markdown" });
    }
});

// Lệnh /start để hiển thị Menu chọn Lớp
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const keyboard = [];
    
    for (let i = 1; i <= 9; i += 3) {
        keyboard.push([
            { text: `Lớp ${i}`, callback_data: `class_Lớp ${i}` },
            { text: `Lớp ${i+1}`, callback_data: `class_Lớp ${i+1}` },
            { text: `Lớp ${i+2}`, callback_data: `class_Lớp ${i+2}` }
        ]);
    }
    keyboard.push([
        { text: `Lớp 10`, callback_data: `class_Lớp 10` },
        { text: `Lớp 11`, callback_data: `class_Lớp 11` }
    ]);

    bot.sendMessage(chatId, "👋 Chào mừng! Vui lòng chọn Lớp để bắt đầu:\n\n💬 _Cần hỗ trợ/Báo lỗi: Liên hệ @ngkhoa1916_", {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: keyboard }
    });
});

// Xử lý khi người dùng bấm nút trên Telegram
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const data = query.data;

    if (data.startsWith('class_')) {
        const selectedClass = data.split('_')[1];
        const giftKeyboard = [
            [{ text: "🎓 Khóa Học", callback_data: `qty_khoahoc_${selectedClass}` }],
            [{ text: "📝 Phòng Luyện", callback_data: `qty_phongluyen_${selectedClass}` }],
            [{ text: "🎁 Bất kỳ (Ra gì lấy đó)", callback_data: `qty_any_${selectedClass}` }]
        ];

        bot.editMessageText(`Bạn đã chọn **${selectedClass}**. Bạn muốn săn quà gì?`, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: { inline_keyboard: giftKeyboard }
        });
    }

    if (data.startsWith('qty_')) {
        const parts = data.split('_');
        const targetGift = parts[1];
        const className = parts[2];
        
        const qtyKeyboard = [
            [{ text: "1 Mã", callback_data: `hunt_${targetGift}_${className}_1` },
             { text: "3 Mã", callback_data: `hunt_${targetGift}_${className}_3` }],
            [{ text: "5 Mã", callback_data: `hunt_${targetGift}_${className}_5` },
             { text: "10 Mã", callback_data: `hunt_${targetGift}_${className}_10` }]
        ];

        bot.editMessageText(`Bạn muốn lấy bao nhiêu mã?`, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: { inline_keyboard: qtyKeyboard }
        });
    }

    if (data.startsWith('hunt_')) {
        const parts = data.split('_');
        const targetGift = parts[1];
        const className = parts[2];
        const quantity = parseInt(parts[3], 10);
        
        const user = query.from;
        const userInfo = user.username ? `@${user.username}` : user.first_name;
        bot.sendMessage(ADMIN_ID, `👀 **Theo dõi:** ${userInfo} (ID: \`${user.id}\`) đang săn **${quantity} mã ${targetGift}** cho **${className}**.`, { parse_mode: "Markdown" });

        activeHunts[chatId] = true;

        bot.editMessageText(`⏳ Đang bắt đầu spam server tìm **${quantity} mã ${targetGift}** cho **${className}**... Vui lòng đợi 🚀`, { 
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: {
                inline_keyboard: [[{ text: "❌ Hủy quá trình", callback_data: "cancel_hunt" }]]
            }
        });
        
        await huntGiftLoop(chatId, className, targetGift, quantity, messageId);
    }

    if (data === 'cancel_hunt') {
        if (activeHunts[chatId]) {
            activeHunts[chatId] = false;
            bot.editMessageText("🛑 Đang tiến hành hủy lệnh... Vui lòng đợi trong giây lát.", {
                chat_id: chatId,
                message_id: messageId
            });
        }
    }
});

async function huntGiftLoop(chatId, className, targetGift, quantity, originalMessageId) {
    let attempts = 0;
    let foundCount = 0;
    const maxAttempts = quantity * 30; 

    while (attempts < maxAttempts && foundCount < quantity) {
        if (!activeHunts[chatId]) {
            bot.editMessageText(`🛑 Quá trình săn quà đã dừng. Thu thập được **${foundCount}/${quantity}** mã.`, { 
                chat_id: chatId,
                message_id: originalMessageId,
                parse_mode: "Markdown" 
            });
            return;
        }

        attempts++;
        const playPhone = randomPhone();
        const birthYear = getYearOfBirth(className);

        const params = {
            action: "get_gift",
            name: "Auto Bot",
            age: birthYear,
            phone: playPhone,
            email: `bot${Math.floor(Math.random()*10000)}@gmail.com`,
            class: className
        };

        try {
            const response = await axios.get(apiBaseUrl, { params });
            const data = response.data;

            if (data.gift && data.gift.Gift_Title) {
                const titleLower = data.gift.Gift_Title.toLowerCase();
                const nameLower = (data.gift.Gift_Name || "").toLowerCase();
                let isMatch = false;

                const isVoucher = titleLower.includes('voucher') || nameLower.includes('voucher');

                if (targetGift === 'any') isMatch = true;
                else if (targetGift === 'khoahoc' && !isVoucher && titleLower.includes('khóa')) isMatch = true;
                else if (targetGift === 'phongluyen' && !isVoucher && titleLower.includes('phòng luyện')) isMatch = true;

                if (isMatch) {
                    foundCount++;
                    const successMsg = `🎉 **THÀNH CÔNG (${foundCount}/${quantity})**\n\n` +
                                       `📱 SĐT: \`${playPhone}\`\n` +
                                       `🎁 Quà: **${data.gift.Gift_Title}**\n` +
                                       `🔑 Mã: \`${data.gift.Gift_Code || 'Không có mã'}\``;
                    
                    bot.sendMessage(chatId, successMsg, { parse_mode: "Markdown" });
                    
                    if (foundCount >= quantity) {
                        bot.editMessageText(`✅ Đã thu thập đủ **${quantity} mã**.\n\n👉 **Kích hoạt tại**: https://hocmai.vn/course/mycourse2.php?t=activationkey\n\n⚠️ _Nếu quá số lần cho phép, hãy đợi 15p-1 tiếng._\n\n💬 _Hỗ trợ: @ngkhoa1916_`, { 
                            chat_id: chatId,
                            message_id: originalMessageId,
                            disable_web_page_preview: true,
                            parse_mode: "Markdown" 
                        });
                        delete activeHunts[chatId];
                        return;
                    }
                }
            }
        } catch (error) {
            console.log(`Lỗi mạng lần ${attempts}`);
        }

        await new Promise(res => setTimeout(res, 1000));
    }

    if (foundCount < quantity && activeHunts[chatId]) {
        bot.editMessageText(`❌ **DỪNG LẠI**\nĐã thử ${maxAttempts} lần nhưng chỉ lấy được ${foundCount}/${quantity} mã.\n\n💬 _Cần hỗ trợ: @ngkhoa1916_`, { 
            chat_id: chatId,
            message_id: originalMessageId,
            parse_mode: "Markdown" 
        });
    }
    
    delete activeHunts[chatId];
}

console.log("🤖 Bot đang chạy!");
