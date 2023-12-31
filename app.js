//jshint esversion:6
require('dotenv').config();

const express = require("express");
const ejs = require("ejs");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");

//Level-5 Cookies Ans Session using PASSPORT
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
//Level-6 requiring Google strategy
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate = require("mongoose-findorcreate");
const FacebookStrategy = require("passport-facebook").Strategy;

const app = express();

app.use(express.static("public"));
app.set('view engine' , 'ejs');

app.use(bodyParser.urlencoded({extended:true}));


//Setting up Session and passport
app.use(session({
    secret: "nobody can decrypt it",
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

//CONNECTION
mongoose.connect("mongodb://127.0.0.1:27017/userDB" ,{useNewUrlParser: true});


const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId: String,
    secret: String,
    facebookId: String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);
//userSchema.plugin(encrypt, {secret: process.env.SECRET , encryptedFields: ["password"] });

const User = new mongoose.model("User" , userSchema);

passport.use(User.createStrategy());

// Serialize the user object
passport.serializeUser((user, done) => {
    done(null, user.id);
  });
  
  // Deserialize the user object
passport.deserializeUser((id, done) => {
    User.findById(id).then((user) => {
      done(null, user);
    }).catch((err)=>{
        console.log(err);
        done(err,null);
    })
  });

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: "http://localhost:3000/auth/facebook/secrets"
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);
    User.findOrCreate({ facebookId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

app.get("/" , function(req,res){
    res.render("home");
});

app.get("/auth/google" , 
    passport.authenticate('google', { scope: ["profile"] })
);

app.get("/auth/google/secrets", 
  passport.authenticate('google', { failureRedirect: "/login" }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect("/secrets");
});

//Adding get routes for facebook authentication
app.get("/auth/facebook",
  passport.authenticate('facebook')
);

app.get("/auth/facebook/secrets",
  passport.authenticate('facebook', { failureRedirect: "/login" }),
  function(req, res) {
    // Successful authentication, redirect page.
    res.redirect("/secrets");
});

app.get("/login" , function(req,res){
    res.render("login");
});

app.get("/register" , function(req,res){
    res.render("register");
});

app.get("/secrets" , function(req,res){
    // if(req.isAuthenticated()){
    //     res.render("secrets");
    // }else{
    //     res.redirect("login");
    // }
    User.find({"secret":{$ne: null}}).then((foundUsers)=>{
         if(foundUsers){
            res.render("secrets", {usersWithSecrets: foundUsers})
         }
    }).catch((err) =>{
        console.log(err);
    })

});

app.get("/logout" ,function(req,res){
    req.logout(function(err){
        if(err){
            console.log(err);
        }else{
            res.redirect("/");
        }
    });
    
});

app.post("/register", function(req,res){
    
    User.register({username: req.body.username}, req.body.password, function(err,user){

            if(err){
                console.log(err);
                res.redirect("/register");
            }else{
                passport.authenticate("local")(req,res,function(){
                    res.redirect("/secrets");
                })
            }
        })
   
});

app.post("/login", function(req,res){
    
    const user = new User({
        username: req.body.username,
        password: req.body.password
    });

    req.logIn(user, function(err){
        if(err){
            console.log(err);
        }else{
            passport.authenticate("local")(req,res,function(){
                res.redirect("/secrets");
            });
        }
    });
    
});

app.get("/submit" , function(req,res){
    if(req.isAuthenticated()){
        res.render("submit");
    }else{
        res.redirect("/login");
    }
});

app.post("/submit", function(req,res){
    const submittedSecret = req.body.secret;
    
    User.findById(req.user.id).then((foundUser) =>{
        if(foundUser){
            foundUser.secret = submittedSecret;
            foundUser.save().then(()=>{
                res.redirect("/secrets");
            });
        }
    })

});

app.listen(3000 , function(){
    console.log("Server running on PORT 3000. ..");
});