const express = require('express');
const cors = require('cors');
const app = express();
const bodyParser = require('body-parser');

let users = [
    {
        'name': 'Pedro',
        'user': 'phos21',
        'password': '123',
        'email' : 'pedro.o.silva.henrique@gmail.com'
    }
]
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));

app.get('/', (req, res) => {
    res.send(users);
})
app.post('/login', (req, res) => {
    if(req.body.email === users[0].email && req.body.password === users[0].password){
        res.status(200).json('success');
    }
    else {
        res.status(400).send('failed');
    }
})
app.post('/register', (req, res) => {
    if(req.body.email !== users[0].email){
        users.push({
            "name": req.body.name,
            "user": req.body.user,
            "password": req.body.password,
            "email": req.body.email
        })
        console.log(req.body)
        res.status(200).send('success');
    }
    else {
        res.status(400).send('failed');
    }
})
app.put('/profile/:id', (req, res) => {
    if(req.body.user === users[0].user && req.body.password === users[0].password){
        res.status(200).send('success');
    }
    else {
        res.status(400).send('failed');
    }
})
app.listen(3001);