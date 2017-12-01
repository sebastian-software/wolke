const express = require('express')
const app = express()

app.get(/.*/, (req, res) => {
  res.send('Hello World! 6' + req.originalUrl + " -- " + req.url)
})

// app.listen(3000) // <-- comment this line out from your app

module.exports = app
