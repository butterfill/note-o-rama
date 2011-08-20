import turbogears as tg
from turbogears import controllers, expose, flash
# from nrama2 import model
from turbogears import identity, redirect
from cherrypy import request, response
# from nrama2 import json
# import logging
# log = logging.getLogger("nrama2.controllers")

class Root(controllers.RootController):
    @expose(template="nrama2.templates.welcome")
    # @identity.require(identity.in_group("admin"))
    def index(self):
        import time
        # log.debug("Happy TurboGears Controller Responding For Duty")
        flash("Your application is now running")
        response.headers['Access-Control-Allow-Origin'] = '*'
        return dict(now=time.ctime())

    @expose(format="json")
    def test(self):
        response.headers['Access-Control-Allow-Origin'] = '*'
        return dict(works='ok')

    @expose(template="nrama2.templates.login")
    def login(self, forward_url=None, *args, **kw):

        if forward_url:
            if isinstance(forward_url, list):
                forward_url = forward_url.pop(0)
            else:
                del request.params['forward_url']

        if not identity.current.anonymous and identity.was_login_attempted() \
                and not identity.get_identity_errors():
            redirect(tg.url(forward_url or '/', kw))

        if identity.was_login_attempted():
            msg = _("The credentials you supplied were not correct or "
                   "did not grant access to this resource.")
        elif identity.get_identity_errors():
            msg = _("You must provide your credentials before accessing "
                   "this resource.")
        else:
            msg = _("Please log in.")
            if not forward_url:
                forward_url = request.headers.get("Referer", "/")

        response.status = 401
        return dict(logging_in=True, message=msg,
            forward_url=forward_url, previous_url=request.path_info,
            original_parameters=request.params)

    @expose()
    def logout(self):
        identity.current.logout()
        redirect("/")
