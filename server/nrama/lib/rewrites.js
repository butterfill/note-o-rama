/**
 * Rewrite settings to be exported from the design doc
 */

module.exports = [
    {from: '/static/*', to: 'static/*'},
    {
        from : '/sources',
        to : '_list/sources/userId_pageId',
        query : { group: 'true' }    //for some reason it must be 'true', not true.
    },
    {
        from : '/source',
        to : '_list/source/pageId_userId'
    },
    {
        from : '/user/:user_id/source/:url',
        to : '_list/source/pageId_userId',
        query : { key : [":url",":user_id"] }
    },
    {
        from: '/all_users',
        to: '_list/all_users/all_user_ids',
        method : 'GET',
        query : { group : 'true' }
    },
    {
        from : '/testme',
        to : '_view/userId_pageId',
        query : { group: 'true' }    //for some reason it must be 'true', not true.
    },
    { from: '/', to: '_show/welcome' },
    {from: '*', to: '_show/not_found'}
];
