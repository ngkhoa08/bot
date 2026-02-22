const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const express = require('express');

// 🔴 THAY TOKEN BOT CỦA BẠN VÀO ĐÂY
const token = '8591949878:AAFxodvzGVEEutXeJ16YP2Ap1raNX8iPdZ8';
const bot = new TelegramBot(token, { polling: true });

const apiBaseUrl = "https://script.google.com/macros/s/AKfycbzgfK1VP8ivsAbNRLdne48XD-7QcwsxdHP47JaLpNdKxN7jVaEuDqZMSkCDSYiT6iwc/exec";

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

// Lệnh /start để hiển thị Menu chọn Lớp
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const keyboard = [];
    
    // Tạo menu lưới 3 cột từ lớp 1 đến lớp 9
    for (let i = 1; i <= 9; i += 3) {
        keyboard.push([
            { text: `Lớp ${i}`, callback_data: `class_Lớp ${i}` },
            { text: `Lớp ${i+1}`, callback_data: `class_Lớp ${i+1}` },
            { text: `Lớp ${i+2}`, callback_data: `class_Lớp ${i+2}` }
        ]);
    }
    // Thêm hàng cuối cùng cho Lớp 10 và 11
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

    // Bước 1: Chọn Lớp xong -> Hiển thị Menu chọn Quà
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

    // Bước 1.5: Chọn Số lượng
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

    // Bước 2: Bắt đầu săn quà
    if (data.startsWith('hunt_')) {
        const parts = data.split('_');
        const targetGift = parts[1]; // khoahoc, phongluyen, any
        const className = parts[2];
        const quantity = parseInt(parts[3], 10);
        
        // Đánh dấu user đang chạy
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

    // Bước 3: Xử lý nút Hủy
    if (data === 'cancel_hunt') {
        if (activeHunts[chatId]) {
            activeHunts[chatId] = false;
            bot.editMessageText("🛑 Đang tiến hành hủy lệnh... Vui lòng đợi trong giây lát.", {
                chat_id: chatId,
                message_id: messageId
            });
        } else {
            bot.answerCallbackQuery(query.id, { text: "⚠️ Không có tiến trình nào đang chạy.", show_alert: true });
        }
    }
});

// Hàm Spam API tới khi ra đúng quà yêu cầu
async function huntGiftLoop(chatId, className, targetGift, quantity, originalMessageId) {
    let attempts = 0;
    let foundCount = 0;
    // Chạy tối đa 30 lần cho 1 mã để tránh bị ban IP (Ví dụ: săn 5 mã sẽ thử tối đa 150 lần)
    const maxAttempts = quantity * 30; 

    while (attempts < maxAttempts && foundCount < quantity) {
        // Kiểm tra xem user có bấm hủy không
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

                // Chặn triệt để mọi loại voucher
                const isVoucher = titleLower.includes('voucher') || nameLower.includes('voucher');

                if (targetGift === 'any') {
                    isMatch = true;
                } else if (targetGift === 'khoahoc') {
                    if (!isVoucher && titleLower.includes('khóa')) {
                        isMatch = true;
                    }
                } else if (targetGift === 'phongluyen') {
                    if (!isVoucher && titleLower.includes('phòng luyện')) {
                        isMatch = true;
                    }
                }

                if (isMatch) {
                    foundCount++;
                    // Gửi mã quà tặng thành một tin nhắn mới riêng biệt để bạn dễ copy
                    const successMsg = `🎉 **THÀNH CÔNG (${foundCount}/${quantity})**\n\n` +
                                       `📱 SĐT đã dùng: \`${playPhone}\`\n` +
                                       `🎓 Lớp: ${className}\n` +
                                       `🎁 Quà: **${data.gift.Gift_Title}**\n` +
                                       `🔑 Mã: \`${data.gift.Gift_Code || 'Không có mã'}\``;
                    
                    bot.sendMessage(chatId, successMsg, { parse_mode: "Markdown" });
                    
                    if (foundCount >= quantity) {
                        bot.editMessageText(`✅ Đã thu thập đủ **${quantity} mã**.\n\n👉 **Vô đây để kích hoạt mã** (đăng nhập trước khi nhấn vô link): https://hocmai.vn/course/mycourse2.php?t=activationkey\n\n⚠️ _Nếu điền tiếp mà hệ thống báo là "Bạn đã nhập quá số lần cho phép" thì hãy đợi 15p-1 tiếng._\n\n💬 _Gặp trục trặc? Liên hệ Admin: @ngkhoa1916_`, { 
                            chat_id: chatId,
                            message_id: originalMessageId,
                            disable_web_page_preview: true,
                            parse_mode: "Markdown" 
                        });
                        delete activeHunts[chatId]; // Xóa trạng thái
                        return; // Thoát vòng lặp khi đủ số lượng
                    }
                }
            }
        } catch (error) {
            console.log(`Lỗi mạng lần ${attempts}`);
        }

        // Delay 1 giây giữa các lần spam để tránh chết server
        await new Promise(res => setTimeout(res, 1000));
    }

    if (foundCount < quantity && activeHunts[chatId]) {
        bot.editMessageText(`❌ **DỪNG LẠI**\nĐã thử ${maxAttempts} lần nhưng chỉ lấy được ${foundCount}/${quantity} mã. Vui lòng gõ /start để làm lại!\n\n💬 _Cần hỗ trợ: @ngkhoa1916_`, { 
            chat_id: chatId,
            message_id: originalMessageId,
            parse_mode: "Markdown" 
        });
    }
    
    delete activeHunts[chatId]; // Dọn dẹp trạng thái
}

console.log("🤖 Bot đang chạy! Hãy vào Telegram gõ /start");


