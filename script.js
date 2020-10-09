const express = require('express');
const session = require('cookie-session');
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
    connection:  {
		connectionString: process.env.DATABASE_URL,
		ssl: {
			rejectUnauthorized: false
		}
	}
  });
/*

    origin: "http://localhost:3000", 
    methods: "GET,POST",
    credentials: true 
*/
app.use(cors({
  origin: "https://fliperio.herokuapp.com/fliper", 
  methods: "GET,POST",
  credentials: true 
}));
app.use(express.static("public"));
app.use(session({ secret: 'ssshhh',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: true,
        sameSite: 'none'
    }
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
app.get('/page/:page', (req, res) => {
    const {page} = req.params;
    db('games').select('*').limit(10).offset(page - 1)
    .then(data => {
        res.status(200).json(data);
    })
    .catch(err => res.status(400).json('Ops... error with the database connection.'))
})
app.post('/search', (req, res) => {
    const {name} = req.body;
    const query = name.replace(/['"]+/g, '').split(/[ ,]+/).join(' | ');

    db.select('name').from('games')
        .where(db.raw(`search_vector @@ to_tsquery('${query}')`))
        .then(data => {
            res.status(200).json(data);
        })
        .catch(err => res.status(200).json([]));
});


app.post('/add/game', (req, res) => {
    const {name, img, description} = req.body;
    let image = img;
   /* let image;
    imageToBase64(img) 
    .then(res => {
        image = res;
    })
    .catch(err => {
        console.log('rear')
    })*/
    if(req.isAuthenticated()) {
        const usr = req.session.passport.user;
        console.log('usr', usr);
        gameExists(usr.id, name).then(data => {
            if(data.length == 0) {
                console.log('A', data);
                db.transaction(trx => {
                    trx.insert({
                        name: name, 
                        image: image,
                        description: description,
                        created_by: usr.id,
                        created_by_name: usr.name
                    })
                    .into('games')
                    .returning(['id', 'name'])
                    .then(data => {
                        res.status(200).json(`Game '${data[0].name}' added`);
                    })
                    .then(trx.commit)
                    .catch(trx.rollback)
                })
                .catch(err => res.status(400).json('Unable to add.'))
            }
            else {  
                res.status(400).json(`You already have a game named '${name}'!`);
            }
        })
        .catch(err => {
            res.status(400).json(`Ops... an error occurred`);
        })
    }
    else {
        res.status(400).json('Not logged in.');
    }
})



app.post('/:game_id/upvote', (req, res) => {
    const {game_id} = req.params;

    if(req.isAuthenticated()) {
        db('games').increment('votes').where('id',game_id)
        .then(data => {
            if(data === 1) res.status(200).json("Upvoted successfully!");
            else throw new Error();
        })
        .catch(err => res.status(400).json("Ops... you cannot upvote this game."));
        
    }
    else {
        res.status(400).json('Not logged in.');
    }
})
app.post('/:game_id/downvote', (req, res) => {
    const {game_id} = req.params;

    if(req.isAuthenticated()) {
        db('games').decrement('votes').where('id',game_id)
        .then(data => {
            if(data === 1) res.status(200).json("Downvoted successfully!");
            else throw new Error();
        })
        .catch(err => res.status(400).json("Ops... you cannot downvote this game."));
        
    }
    else {
        res.status(400).json('Not logged in.');
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

app.get('/auth/google/check', (req, res) => {
    
    if(req.isAuthenticated()) {
        res.status(200).json('LOGIN_SUCCESS');
    }
    else {
        res.status(400).json('Login failed.');
    }
})
app.get('/profile/:id', (req, res) => {
    const {id} = req.params;
    
    if(req.isAuthenticated() && req.session.passport.user.id === parseInt(id)) {
        res.status(200).json(req.session.passport.user);
    }
    else {
        res.status(400).json('Not logged in.');
    }
})
app.listen(process.env.PORT || 3000);