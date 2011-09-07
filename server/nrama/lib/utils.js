/**
 * utilities for nrama
 *
 * Copyright (c) 2011 Stephen A. Butterfill, http://note-o-rama.com
 * 
 */

var dateFormat = require('./date_format').dateFormat;

/**
 * be nice to ie
 */
exports.dateToIsoString = function(date) {
    if( date.toISOString) {
        return date.toISOString();
    }
    return dateFormat(date,"isoDateTime");
    
}