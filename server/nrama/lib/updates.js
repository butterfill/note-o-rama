/**
 * Update functions to be exported from the design doc.
 */

var utils = require('./utils'),
    _ = require('kanso/underscore')._;



/**
 * TODO : doesn't currently update anything apart from 'updated'
 *  shortcut it: {
   "source": "function(doc, req){var fn = require(\"lib/app\")[\"updates\"][\"source\"];return fn(doc,req);}"
}
 */
exports.source = function (doc, req) {

    var make_error = function(msg) {
        var form_str;
        for( var i in req.form ) { form_str+=i+' : '+ req.form[i]+ '\n'; };
        return [nul, {
            code: 400,  //doesn't currently work, see https://issues.apache.org/jira/browse/COUCHDB-648
            headers: {"Content-Type" : "application/json"},
            body: '{"error":"'+msg+'","req_form":"'+form_str+'","req_body":"'+req.body+'"}'
        }];
    };
    
    if( !doc ) {
        //create new source
        var data = req.form;
        
        if( !data._id ) {
            return make_error('error: no doc_id');
        }
        if ( !data.type || !data.type == 'source' ) {
            return make_error('error: type missing or not set to source.');
        }
            /*
            {
                code: 400,  //doesn't currently work, see https://issues.apache.org/jira/browse/COUCHDB-648
                headers: {"Content-Type" : "text/plain"},
                body: {error:'bad request -- must specify _id and type as "source"'}
            }];
            */
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
        doc.updated = new Date().getTime();
        return [doc,  {
            code: 200,  //doesn't currently work, see https://issues.apache.org/jira/browse/COUCHDB-648
            headers: {"Content-Type" : "application/json"},
            body: '{"updated":"updated"}'
        }];
    }
};


