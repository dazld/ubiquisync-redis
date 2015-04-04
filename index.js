"use strict";

var redis = require('redis');
var sync = require('ubiquisync');
var Promise = require('bluebird');

var client = redis.createClient();

client.on("error", function (err) {
    console.log("Error " + err);
});

var reading = Promise.promisify(client.get, client);
var setting = Promise.promisify(client.set, client);


function setKey(key, value, expires){
    return new Promise(function(resolve, reject){
        expires = expires || 120; // seconds
        client.set(key, JSON.stringify(value), resolve.bind(null, value));
        if (expires) {
            client.expire(key, expires);
        }
    });
    
}

var wrappedSync = function(method, model, options){
    options = options || {};
    var url =  model.url();

    // only cache gets
    if (method === 'read') {

        console.log('trying to get from cache:', url);
        // do we have a cached value?
        return reading(url).then(function(val){
            if (val !== null) {
                return JSON.parse(val);
            } else {
                console.log('trying to cache:', url);
                var syncing = sync.call(null, method, model, options);
                return syncing.then(function(body){
                    return setKey(url, body);
                }).catch(function(err){
                    console.log('prob when fetching',err);
                    throw err;
                });
            }
            
        }).then(function(body){
            ['success', 'complete'].forEach(function(fn){
                options[fn] && options[fn](body);
            });
        }).catch(function(err){
            ['error', 'complete'].forEach(function(fn){
                options[fn] && options[fn](err);
            });
            console.log(err, err.stack);
        });

        
    } else {
        return sync.call(null, method, model, options);
    }

    
};

module.exports = wrappedSync;
