const express = require('express'),
    bodyParser = require('body-parser'),
    morgan = require('morgan'),
    // import built in node modules fs and path
    fs = require('fs'),
    path = require('path');

const { check, validationResult } = require('express-validator');

const app = express();
const mongoose = require('mongoose');
const Models = require('./models.js');

const Movies = Models.Movie;
const Users = Models.User;

// mongoose.connect('mongodb://localhost:27017/myFlixDB', { useNewUrlParser: true, useUnifiedTopology: true });
mongoose.connect(process.env.CONNECTION_URI, { useNewUrlParser: true, useUnifiedTopology: true });

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const cors = require('cors');
// app.use(cors());

const allowedOrigins = [
    'http://localhost:8080',
    'http://localhost:4200',
    'https://myflix-firstapi-app.herokuapp.com',
    'http://localhost:1234',
    'https://myflix-movie-client-react.netlify.app',
    'https://rmoise.github.io'
];

app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);
            if (allowedOrigins.indexOf(origin) === -1) {
                // If a specific origin isn’t found on the list of allowed origins
                let message = 'The CORS policy for this application doesn’t allow access from origin ' + origin;
                return callback(new Error(message), false);
            }
            return callback(null, true);
        }
    })
);

require('./auth')(app);
const passport = require('passport');
require('./passport');
// create a write stream (in append mode)
// a ‘log.txt’ file is created in root directory
const accessLogStream = fs.createWriteStream(path.join(__dirname, 'log.txt'), { flags: 'a' });
// setup the logger
app.use(morgan('combined', { stream: accessLogStream }));
app.use(express.static('public'));
app.get('/documentation', (req, res) => {
    res.sendFile('public/documentation.html', { root: __dirname });
});

/**
 * GET welcome page, which contains a welcome message and a link to documentation from '/' endpoint
 * @name welcomePage
 * @kind function
 * @returns Welcome page
 */
app.get('/', (req, res) => {
    res.send('Welcome to MyFlix!');
});

// get all movies
/**
 * READ:get full movie list
 * Request body: None
 * @name getAllMovies
 * @kind function
 * @returns A JSON object holding data of all the movies.
 * @requires passport
 */
app.get('/movies', passport.authenticate('jwt', { session: false }), (req, res) => {
    Movies.find()
        .then((movies) => {
            res.status(200).json(movies);
        })
        .catch((err) => {
            console.error(err);
            res.status(500).send('Error: ' + err);
        });
});

// get movies by title
/**
 * READ: get data of a single movie
 * Request body: None
 * @name getSingleMovie
 * @kind function
 * @param {string} Title The title of the movie
 * @returns A JSON object holding data about a single movie, containing title, description, genre, director, imageURL and featured or not.
 * @requires passport
 */
app.get('/movies/:Title', passport.authenticate('jwt', { session: false }), (req, res) => {
    Movies.findOne({ Title: req.params.Title })
        .then((movie) => {
            res.status(200).json(movie);
        })
        .catch((err) => {
            console.error(err);
            res.status(500).send('Error: ' + err);
        });
});

// get genre by name
/**
 * READ: get data about a genre by name
 * Request body: None
 * @name getGenre
 * @kind function
 * @returns A JSON object holding data about a single genre, containing name and description.
 * @requires passport
 */
app.get('/movies/genres/:Name', passport.authenticate('jwt', { session: false }), (req, res) => {
    Movies.findOne({ 'Genre.Name': req.params.Name })
        .then((movies) => {
            res.status(200).send(movies.Genre);
        })
        .catch((err) => {
            console.error(err);
            res.status(500).send('Error: ' + err);
        });
});

// get director by name
/**
 * READ: get data about a director by name
 * Request body: None
 * @name getDirector
 * @kind function
 * @returns A JSON object holding data about a single director, containing name, bio, birth year and death year.
 * @requires passport
 */
app.get('/movies/directors/:Name', passport.authenticate('jwt', { session: false }), (req, res) => {
    Movies.findOne({ 'Director.Name': req.params.Name })
        .then((movies) => {
            res.status(200).send(movies.Director);
        })
        .catch((err) => {
            console.error(err);
            res.status(500).send('Error: ' + err);
        });
});

// Get all users
/**
 * READ:get full user list
 * Request body: None
 * @name getAllUsers
 * @kind function
 * @returns A JSON object holding data of all the users.
 * @requires passport
 */
app.get('/users', passport.authenticate('jwt', { session: false }), (req, res) => {
    Users.find()
        .then((users) => {
            res.status(200).json(users);
        })
        .catch((err) => {
            console.error(err);
            res.status(500).send('Error: ' + err);
        });
});

/**
 * READ: get data of a single user
 * Request body: None
 * @name getUser
 * @kind function
 * @param {string} Username
 * @returns A JSON object holding data of the particular user.
 * @requires passport
 */
app.get('/users/:Username', passport.authenticate('jwt', { session: false }), (req, res) => {
    Users.findOne({ Username: req.params.Username })
        .then((user) => {
            res.json(user);
        })
        .catch((err) => {
            console.error(err);
            res.status(500).send('Error: ' + err);
        });
});

// add a user
/**
 * Create: post data of a new user
 * Request body: A JSON object holding data about the new user, containing username, password, email and birthday.
 * @name createUser
 * @kind function
 * @returns A JSON object holding data of the user.
 * @requires passport
 */
app.post(
    '/users',
    [
        check('Username', 'Username is required').isLength({ min: 5 }),
        check('Username', 'Username contains non alphanumeric characters - not allowed.').isAlphanumeric(),
        check('Password', 'Password is required').not().isEmpty(),
        check('Email', 'Email does not appear to be valid').isEmail()
    ],
    (req, res) => {
        // check the validation object for errors
        let errors = validationResult(req);

        if (!errors.isEmpty()) {
            return res.status(422).json({ errors: errors.array() });
        }

        let hashedPassword = Users.hashPassword(req.body.Password);
        Users.findOne({ Username: req.body.Username })
            .then((user) => {
                if (user) {
                    return res.status(400).send(req.body.Username + ' already exists');
                } else {
                    Users.create({
                        Username: req.body.Username,
                        Password: hashedPassword,
                        Email: req.body.Email,
                        Birthday: req.body.Birthday
                    })
                        .then((user) => {
                            res.status(201).json(user);
                        })
                        .catch((error) => {
                            console.error(error);
                            res.status(500).send('Error: ' + error);
                        });
                }
            })
            .catch((error) => {
                console.error(error);
                res.status(500).send('Error: ' + error);
            });
    }
);

// allow users to update their info
/**
 * UPDATE: put a user's updated info
 * Request body: 	A JSON object holding data about the updated user information.
 * @name updateUser
 * @kind function
 * @param {string} Username
 * @returns A JSON object holding the updated data of the user.
 * @requires passport
 */
app.put(
    '/users/:Username',
    passport.authenticate('jwt', { session: false }),
    [
        check('Username', 'Username is required').isLength({ min: 5 }),
        check('Username', 'Username contains non alphanumeric characters - not allowed.').isAlphanumeric(),
        check('Password', 'Password is required').not().isEmpty(),
        check('Email', 'Email does not appear to be valid').isEmail()
    ],
    (req, res) => {
        // check the validation object for errors
        let errors = validationResult(req);

        if (!errors.isEmpty()) {
            return res.status(422).json({ errors: errors.array() });
        }

        let hashedPassword = Users.hashPassword(req.body.Password);
        Users.findOneAndUpdate(
            { Username: req.params.Username },
            {
                $set: {
                    Username: req.body.Username,
                    Password: hashedPassword,
                    Email: req.body.Email,
                    Birthday: req.body.Birthday
                }
            },
            { new: true }, // This line makes sure that the updated document is returned
            (err, updatedUser) => {
                if (err) {
                    console.error(err);
                    res.status(500).send('Error: ' + err);
                } else {
                    res.json(updatedUser);
                }
            }
        );
    }
);

// Delete a user by username
/**
 * DELETE: Delete a user data
 * Request body: None
 * @name deleteUser
 * @kind function
 * @param {string} Username
 * @returns A text message indicating the user's data has been removed.
 * @requires passport
 */
app.delete('/users/:Username', passport.authenticate('jwt', { session: false }), (req, res) => {
    Users.findOneAndRemove({ Username: req.params.Username })
        .then((user) => {
            if (!user) {
                res.status(400).send(req.params.Username + ' was not found');
            } else {
                res.status(200).send(req.params.Username + ' was deleted.');
            }
        })
        .catch((err) => {
            console.error(err);
            res.status(500).send('Error: ' + err);
        });
});

// Add a movie to a user's list of favorites
/**
 * POST: Add a movie to a user's list of favorites
 * Request body: None
 * @name addFavoriteMovie
 * @kind function
 * @param {string} Username
 * @param {string} MovieID
 * @returns A JSON object holding the updated data of the user.
 * @requires passport
 */
app.post('/users/:Username/movies/:MovieID', passport.authenticate('jwt', { session: false }), (req, res) => {
    Users.findOneAndUpdate(
        { Username: req.params.Username },
        {
            $push: { FavoriteMovies: req.params.MovieID }
        },
        { new: true }, // This line makes sure that the updated document is returned
        (err, updatedUser) => {
            if (err) {
                console.error(err);
                res.status(500).send('Error: ' + err);
            } else {
                res.json(updatedUser);
            }
        }
    );
});

// Remove a movie to a user's list of favorites
/**
 * DELETE:Delete a movie from a user's list of favorites
 * Request body: None
 * @name deleteFavoriteMovie
 * @kind function
 * @param {string} Username
 * @param {string} MovieID
 * @returns A JSON object holding the updated data of the user.
 * @requires passport
 */
app.delete('/users/:Username/movies/:MovieID', passport.authenticate('jwt', { session: false }), (req, res) => {
    Users.findOneAndUpdate(
        { Username: req.params.Username },
        {
            $pull: { FavoriteMovies: req.params.MovieID }
        },
        { new: true }, // This line makes sure that the updated document is returned
        (err, updatedUser) => {
            if (err) {
                console.error(err);
                res.status(500).send('Error: ' + err);
            } else {
                res.json(updatedUser);
            }
        }
    );
});

//error handling middleware function
/**
 * Error handler
 * @name errorHandler
 * @kind function
 */
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

/**
 * Request listener
 */
const port = process.env.PORT || 8080;
app.listen(port, '0.0.0.0', () => {
    console.log('Listening on Port ' + port);
});
