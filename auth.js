const CLIENT_ID = "721463989337-95k6qc6jl7852v5monbv2rkcr7qur704.apps.googleusercontent.com";
const CLIENT_SECRET_KEY = "vLALNGuMYgpOOkB2EkTvbQep";
const GoogleStrategy = require( 'passport-google-oauth2' ).Strategy;
const passport = require('passport'), LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');


module.exports = (db, app) => {
    
    const validateEmail = email => {
        const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return re.test(String(email).toLowerCase());
    }
    const saveGoogleUser = async (email, name) => {
        return db.transaction((trx) => {
          trx.insert({
              username : null,
              email: email,
              hash: null,
              googleaccount: true
          })
          .into('login')
          .returning('email')
          .then(loginEmail => {
            return trx('users').returning('*')
              .insert({
                  name: name.givenName + ' ' + name.familyName,
                  email: loginEmail[0],
                  joined: new Date()
              })
          })
          .then(trx.commit)
          .catch(trx.rollback);
        })
        .then()
    }
    app.use(passport.initialize());
    app.use(passport.session());

    passport.serializeUser((user, done) => {
        done(null, user);
    });
    passport.deserializeUser((user, done) => {
        done(null, user);
    });

    passport.use(new LocalStrategy({
        usernameField: 'login'
    },
        (login, password, done) => {
            const check = validateEmail(login) ? 'email' : 'username';
            
            db.select('*').from('login')
            .where(check, '=', login)
            .then(data => {
                const {hash, googleaccount, email} = data[0];
                if(googleaccount) {
                    done(null, false, { message: 'ERROR 23'});
                }
                else {
                    const match = bcrypt.compareSync(password, hash);
                    if(match) {
                        return db.select('*').from('users')
                            .where('email', '=', email)
                            .then(user => {
                                done(null, user[0])
                            })
                            .catch(err => done(null, false, {message: 'Login failed.'}))
                    }
                    throw new Error();
                }
            })
            .catch(err => done(null, false, { message: 'Wrong Credentials.'}));
        }
    ));
     
    passport.use(new GoogleStrategy({
        clientID:     CLIENT_ID,
        clientSecret: CLIENT_SECRET_KEY,
        callbackURL: "https://fliperio.herokuapp.com/auth/google/callback"
    },
        (accessToken, refreshToken, profile, done) => { 

            const {email, name} = profile;

            db.select('email', 'id', 'name').from('users')
            .where('email', '=', email)
            .then(data => {
                if(data.length == 0) {
                  const response = await saveGoogleUser(email, name);
                  console.log('r', response);
                  return response[0];
                }
                else return data[0];
            })
            .then(data => {
              console.log('Data: ', data);
              const temp_user = {
                  name: data.name,
                  id: data.id,
                  email: data.email
              }
              return done(null, temp_user);
          })
          .catch(err => done(null, null, {message: 'Ops... an error occurred.'}))
           
        }
    ));
    app.get('/auth/google/failed', (req, res) => {
        res.status(401).json('Login failed.');
    })
    app.get('/auth/google/success', (req, res) => {
        res.redirect('http://localhost:3000');
    })
    app.get('/auth/google', passport.authenticate('google', { scope: 
        [ 'https://www.googleapis.com/auth/userinfo.profile',
        , 'https://www.googleapis.com/auth/userinfo.email' ] }
    ));

    app.get('/auth/google/callback', passport.authenticate('google', {
        successRedirect: '/auth/google/success',
        failureRedirect: '/auth/google/failed'
    }));

    app.post('/login', (req, res, next ) => {
        passport.authenticate('local', (err, user, info) => {
            if (err) return next(err);
            if (!user) {
                if(info.message === 'ERROR 23') {
                    return res.status(400).json('Error, login with your google account');
                }
                else {
                    return res.status(404).json(info.message);
                }
            }
            req.logIn(user, (err) => {
                if (err) { return next(err); }
                return res.status(200).json('LOGIN_SUCCESS');
            });
        })(req, res, next)
    });
    app.post('/register', (req, res) => {
        const {name, username, email, password} = req.body;

        /*isEmailReg(email).then(data => {
            if(data.length == 0 && gmailRegex.test(String(email).toLowerCase())) {
                res.redirect('http://localhost:3001/auth/google');
            }
        });*/

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
                                res.status(200).json('Registered');
                            })
                    })
                    .then(trx.commit)
                    .catch(trx.rollback);
                })
                .catch(err => res.status(400).json('Unable to Register'));
            }
        });
    })
}


