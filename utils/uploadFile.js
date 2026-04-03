let multer = require('multer')
let path = require('path')

// Lưu tất cả các loại file (không chỉ ảnh)
let storageSetting = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "uploads/")
    },
    filename: function (req, file, cb) {
        let ext = path.extname(file.originalname)
        let name = Date.now() + "-" + Math.round(Math.random() * 2000_000_000) + ext;
        cb(null, name)
    }
})

module.exports = multer({
    storage: storageSetting,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
})
