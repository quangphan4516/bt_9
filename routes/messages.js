var express = require('express');
var router = express.Router();
let { checkLogin } = require('../utils/authHandler')
let messageSchema = require('../schemas/messages')
let upload = require('../utils/uploadFile')

/**
 * GET /api/v1/messages/
 * Lấy message cuối cùng của mỗi user mà user hiện tại đã nhắn tin hoặc nhắn cho user hiện tại
 */
router.get('/', checkLogin, async function (req, res, next) {
    try {
        let currentUserId = req.user._id;

        // Lấy tất cả messages liên quan đến user hiện tại
        let messages = await messageSchema.find({
            $or: [
                { from: currentUserId },
                { to: currentUserId }
            ]
        })
            .sort({ createdAt: -1 })
            .populate('from', 'username email avatarUrl fullName')
            .populate('to', 'username email avatarUrl fullName');

        // Nhóm theo "người đối thoại" và lấy message cuối cùng
        let conversationMap = {};

        for (let msg of messages) {
            // Xác định "người còn lại" trong cuộc hội thoại
            let partnerId = msg.from._id.toString() === currentUserId.toString()
                ? msg.to._id.toString()
                : msg.from._id.toString();

            // Chỉ lưu message đầu tiên gặp (đã sort -1 nên đây là mới nhất)
            if (!conversationMap[partnerId]) {
                conversationMap[partnerId] = msg;
            }
        }

        let lastMessages = Object.values(conversationMap);

        res.send(lastMessages);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

/**
 * POST /api/v1/messages/
 * Gửi tin nhắn đến một user
 * Body: to (userID), text (nếu là text message)
 * File: upload (field 'file') nếu gửi file
 */
router.post('/', checkLogin, upload.single('file'), async function (req, res, next) {
    try {
        let currentUserId = req.user._id;
        let { to, text } = req.body;

        if (!to) {
            return res.status(400).send({ message: "Thiếu thông tin người nhận (to)" });
        }

        let messageContent;

        if (req.file) {
            // Có upload file
            messageContent = {
                type: "file",
                text: req.file.path
            };
        } else {
            // Gửi text
            if (!text) {
                return res.status(400).send({ message: "Thiếu nội dung tin nhắn (text)" });
            }
            messageContent = {
                type: "text",
                text: text
            };
        }

        let newMessage = new messageSchema({
            from: currentUserId,
            to: to,
            messageContent: messageContent
        });

        await newMessage.save();
        await newMessage.populate('from', 'username email avatarUrl fullName');
        await newMessage.populate('to', 'username email avatarUrl fullName');

        res.status(201).send(newMessage);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

/**
 * GET /api/v1/messages/:userID
 * Lấy toàn bộ messages giữa user hiện tại và userID
 * (from: currentUser, to: userID) VÀ (from: userID, to: currentUser)
 */
router.get('/:userID', checkLogin, async function (req, res, next) {
    try {
        let currentUserId = req.user._id;
        let { userID } = req.params;

        let messages = await messageSchema.find({
            $or: [
                { from: currentUserId, to: userID },
                { from: userID, to: currentUserId }
            ]
        })
            .sort({ createdAt: 1 })
            .populate('from', 'username email avatarUrl fullName')
            .populate('to', 'username email avatarUrl fullName');

        res.send(messages);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

module.exports = router;
