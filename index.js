const express = require('express')
const bodyParser = require('body-parser')
const Pusher = require('pusher')
const app = express()
const logger = require('morgan')

const config = require('./config.json')

// Body parser middleware
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
// Session middleware

// Create an instance of Pusher
const pusher = new Pusher(config.pusher)

app.use(logger('dev'))

// tells express to search these local folders for assets
app.use('/assets', express.static(__dirname + '/public_assets'))

app.get('/', (req, res) => {
    return res.sendFile(__dirname + '/index.html')
})

// get authentictation for the channel
app.post("/pusher/auth", (req, res) => {
    const socketId = req.body.socket_id
    const channel = req.body.channel_name
    var presenceData = {
        user_id:
        Math.random()
        .toString(36)
        .slice(2) + Date.now()
    } //In the example above, we are just passing a random unique id to each user. In a real-world application, you might need to pass in the user id from the database or other authentication methods as used in your app.
    const auth = pusher.authenticate(socketId, channel, presenceData)
    res.send(auth)
})

//listen on the app
app.listen(3000, () => {
    return console.log('Server is up on 3000')
})