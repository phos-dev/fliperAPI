const express = require('express');
const cors = require('cors');
const app = express();
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const fetch = require('node-fetch');
const IGDB_API_KEY = 'd0205a3f20063d4b4779d67d81a09875';
const db = require('knex')({
    client: 'pg',
    version: '7.2',
    connection: {
      host : '127.0.0.1',
      user : 'postgres',
      password : 'Mainyasuo4282',
      database : 'postgres'
    }
  });

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));
  
const validateEmail = email => {
    const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
}


app.get('/', (req, res) => {
    db.select('*').from('users').then(data => {
        res.send(data);
    });
})

app.post('/search', (req, res) => {
   
    console.log(req.body.name); 
    const {name} = req.body;
    fetch("https://api-v3.igdb.com/games", 
    {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'user-key': IGDB_API_KEY
        },
        body: 'fields name, involved_companies; search "'+ name +'"; limit 10;'
    })
    .then(response => response.json())
    .then(data => res.status(200).json(data))
    .catch(err => res.status(400).json('Ops... cannot search.'));
});

app.post('/login', (req, res) => {
    const {login, password} = req.body;
    const check = validateEmail(login) ? 'email' : 'username';
    
    db.select(check, 'hash').from('login')
        .where(check, '=', login)
        .then(data => {
            const match = bcrypt.compareSync(password, data[0].hash);
            console.log(match);
            if(match) {
                return db.select('*').from('users')
                    .then(user => {
                        res.status(200).json('LOGIN_SUCCESS');
                    })
                    .catch(err => res.status(400).json('Login Failed'))
            }
        })
        .catch(err => res.status(400).json('Wrong credentials'));

})
app.post('/register', (req, res) => {
    const {name, username, email, password} = req.body;

    bcrypt.hash(password, 10, function(err, hash) {
        if(hash) {
            db.transaction(trx => {
                trx.insert({
                    username : username,
                    email: email,
                    hash: hash
                })
                .into('login')
                .returning('email')
                .then(loginEmail => {
                    return trx('users')
                        .returning('*')
                        .insert({
                            name: name,
                            email: loginEmail[0],
                            joined: new Date()
                        })
                        .then(user => {
                            res.json(user[0]);
                        })
                })
                .then(trx.commit)
                .catch(trx.rollback);
            })
            .catch(err => res.status(400).json('Unable to Register'));
        }
    });
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