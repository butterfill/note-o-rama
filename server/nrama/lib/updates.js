/**
 * Update functions to be exported from the design doc.
 */

var utils = require('./utils'),
    _ = require('./underscore')._;  //nb NOT the version shipped with kanso 0.0.7 -- that lacks _.union



/**
 * This will only accept json data (no submission)
 *  to remove kanso wrapping around it, modify the _design entry to: {
   "source": "function(doc, req){var fn = require(\"lib/app\")[\"updates\"][\"source\"];return fn(doc,req);}"
}
 */
exports.source = function (doc, req) {

    var make_error = function(msg) {
        var form_str;
        for( var i in req.form ) { form_str+=i+' : '+ req.form[i]+ '\n'; };
        return [null, {
            code: 400,  //doesn't currently work, see https://issues.apache.org/jira/browse/COUCHDB-648
            headers: {"Content-Type" : "application/json"}, //doesn't currently work
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
        return [new_source, 'created'];
    } else {
        additions = JSON.parse(req.body);
        //-- append tags 
        var new_tags = _.union(doc.tags||[], additions.tags||[]);
        doc = _.extend(doc, additions, {tags:new_tags});
        
        doc.updated = new Date().getTime();
        return [doc,  'updated '+new_tags 
          /*{
            code: 200,  //doesn't currently work, see https://issues.apache.org/jira/browse/COUCHDB-648
            //headers: {"Content-Type" : "application/json"}, //doesn't seem to work either
            headers: {"Content-Type" : 'text/html'},        //this is what you get 
            body: 'updated'
          }*/
        ];
    }
};


