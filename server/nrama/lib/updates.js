/**
 * Update functions to be exported from the design doc.
 */

var utils = require('./utils'),
    _ = require('kanso/underscore')._;



/**
 * This will only accept json data (no submission)
 *  shortcut it: {
   "source": "function(doc, req){var fn = require(\"lib/app\")[\"updates\"][\"source\"];return fn(doc,req);}"
}
 */
exports.source = function (doc, req) {

    var make_error = function(msg) {
        var form_str;
        for( var i in req.form ) { form_str+=i+' : '+ req.form[i]+ '\n'; };
        return [null, {
            code: 400,  //doesn't currently work, see https://issues.apache.org/jira/browse/COUCHDB-648
            headers: {"Content-Type" : "application/json"},
            body: '{"error":"'+msg+'","req_form":"'+form_str+'","req_body":"'+req.body+'"}'
        }];
    };
    
    if( !doc ) {
        //create new source
        //var data = req.form;
        var data = JSON.parse(req.body);
        
        if( !data._id ) {
            return make_error('error: no doc_id supplied in submitted data');
        }
        if ( !data.type || !data.type == 'source' ) {
            return make_error('error: type missing or not set to source.');
        }
        var new_source = _.extend({}, data, {
            _id : data._id,
            created : new Date().getTime(),
            updated : new Date().getTime()
        });
        return [new_source, {
            code: 201,  //doesn't currently work, see https://issues.apache.org/jira/browse/COUCHDB-648
            headers: {"Content-Type" : "application/json"},
            body: '{"created":"created"}'
        }];
    } else {
        if( req.form ) {
            doc = _.extend(doc,req.form);
        } 
        doc = _.extend(doc, JSON.parse(req.body));
        
        doc.updated = new Date().getTime();
        return [doc,  {
            code: 200,  //doesn't currently work, see https://issues.apache.org/jira/browse/COUCHDB-648
            headers: {"Content-Type" : "application/json"},
            body: '{"updated":"updated"}'
        }];
    }
};


