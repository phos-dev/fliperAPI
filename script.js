const express = require('express');
const session = require('express-session');
const cors = require('cors');
const app = express();
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const IGDB_API_KEY = 'd0205a3f20063d4b4779d67d81a09875';
const imageToBase64 = require('image-to-base64');
const passport = require('passport');
const auth = require('./auth');
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
app.use(express.static("public"));
app.use(session({ secret: 'ssshhh',
    resave: false,
    saveUninitialized: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
auth(db, app);

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


app.post('/add/game', (req, res) => {
    const {name, img, description} = req.body;
    const {id} = req.session.passport.user;
    let image;
    imageToBase64(img) 
    .then(res => {
        image = res;
    })
    .catch(err => {
        console.log('rear')
    })
    if(req.isAuthenticated()) {
        const gE = gameExists(id, name);
        gE.then(data => {
            if(data.length == 0) {
                db.transaction(trx => {
                    trx.insert({
                        name: name, 
                        image: image,
                        description: description,
                        created_by: id
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
    else {
        res.status(400).json('Not logged in.');
    }
})



app.post('/:game_id/upvote', (req, res) => {
    const {game_id} = req.params;
    try {
        if(req.isAuthenticated()) {
            res.status(200).json(sess.user);
        }
        else {
            res.status(400).json('Not logged in.');
        }
    }
    catch {

    }
    
})
app.get('/profile/:id/games', (req, res) => {
    const {id} = req.params;
    db.select('*').from('games')
    .where('created_by', '=', id)
    .then(data => {
        res.status(200).json(data);
    })
    .catch(err => res.status(400));
})
app.get('/profile/:id', (req, res) => {
    
    if(isLoggedIn(sess.user.id)) {
        res.status(200).json(sess.user);
    }
    else {
        res.status(400).json('Not logged in.');
    }
})
app.listen(3001);