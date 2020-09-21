const express = require('express');
const session = require('express-session');
const cors = require('cors');
const app = express();
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const fetch = require('node-fetch');
const IGDB_API_KEY = 'd0205a3f20063d4b4779d67d81a09875';
const imageToBase64 = require('image-to-base64');
let sess;
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
app.use(session({ secret: 'ssshhh',
    resave: false,
    saveUninitialized: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));
  

const validateEmail = email => {
    const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
}
const isLoggedIn = id => {
    try {
        if(id != sess.user.id) {
            throw new Error();
        }
        return true;
    }
    catch {
        return false;
    }
}

const gameExists = (userId, name) => {
    const exists = db.select('name', 'created_by').from('games')
        .where({
            created_by: userId,
            name: name
        })
        .then(data => {
            return data;
        })
        .catch(err => {
            console.log('Ops... an error occurred')
        });
    return exists;
}


app.get('/', (req, res) => {
    db.select('*').from('users').then(data => {
        res.json(data);
    });
})

app.post('/search', (req, res) => {
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
    sess = req.session;
    db.select(check, 'hash').from('login')
        .where(check, '=', login)
        .then(data => {
            const match = bcrypt.compareSync(password, data[0].hash);
            if(match) {
                return db.select('*').from('users')
                    .where(check, '=', login)
                    .then(user => {
                        res.status(200).json('LOGIN_SUCCESS');
                        sess.user = user[0];
                    })
                    .catch(err => res.status(400).json('Login Failed'))
            }
        })
        .catch(err => res.status(400).json('Wrong credentials'));

});
app.post('/add/game', (req, res) => {
    const {name, img, description} = req.body;
    let image;
    imageToBase64(img) 
    .then(res => {
        image = res;
    })
    .catch(err => {
        console.log('rear')
    })
    try {
        const gE = gameExists(sess.user.id, name);
        gE.then(data => {
            if(data.length == 0) {
                db.transaction(trx => {
                    trx.insert({
                        name: name, 
                        image: image,
                        description: description,
                        created_by: sess.user.id
                    })
                    .into('games')
                    .returning('name')
                    .then(name => res.status(200).json(`Game '${name}' added`))
                    .then(trx.commit)
                    .catch(trx.rollback);
                })
                .catch(err => res.status(400).json('Unable to add.'));
            }
            else {  
                res.status(400).json(`You already have a game named '${name}'!`);
            }
        })
    }
    catch {
        res.status(400).json('Not logged in.');
    }
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
                            res.status(200).json(user[0]);
                        })
                })
                .then(trx.commit)
                .catch(trx.rollback);
            })
            .catch(err => res.status(400).json('Unable to Register'));
        }
    });
})
app.get('/profile/:id', (req, res) => {
    if(isLoggedIn(req.params.id)) {
        res.status(200).json(sess.user);
    }
    else {
        res.status(400).json('Not logged in.');
    }
})
app.listen(3001);