var	fs = require('fs'),
	path = require('path'),

  User = require.main.require('./user');
  Topics = require.main.require('./topics');
  Categories = require.main.require('./categories');
  meta = require.main.require('./meta');
  nconf = require.main.require('nconf');
  async = require.main.require('async');

	winston = require.main.require('winston'),
	Meta = require.main.require('./src/meta'),

	Emailer = {},
	Mailgun = require('mailgun-js'),
	server;

Emailer.init = function(params, callback) {
	function render(req, res, next) {
		res.render('admin/plugins/emailer-mailgun', {});
	}

	Meta.settings.get('mailgun', function(err, settings) {
		if (!err && settings && settings.apiKey && settings.domain) {
			server = Mailgun({
				apiKey: settings.apiKey,
				domain: settings.domain
			});
		} else {
			winston.error('[plugins/emailer-mailgun] API key or Domain not set!');
		}
	});

	params.router.get('/admin/plugins/emailer-mailgun', params.middleware.admin.buildHeader, render);
	params.router.get('/api/admin/plugins/emailer-mailgun', render);

	callback();
};

Emailer.send = function(data, callback) {
	if (!server) {
		winston.error('[emailer.mailgun] Mailgun is not set up properly!')
		return callback(null, data);
	}

	server.messages().send({
		to: data.to,
		subject: data.subject,
		from: data.from,
		html: data.html,
		text: data.plaintext
	}, function (err, body) {
		if (!err) {
			winston.verbose('[emailer.mailgun] Sent `' + data.template + '` email to uid ' + data.uid);
		} else {
			winston.warn('[emailer.mailgun] Unable to send `' + data.template + '` email to uid ' + data.uid + '!!');
			winston.error('[emailer.mailgun] (' + err.message + ')');
		}

		return callback(err, data);
	});
};

Emailer.sendPost = function(post, callback) {
    post = post.post;
    
    if (post.isMain) {
        var content = post.content;
        
        async.parallel({
            user: function(callback) {
                User.getUserFields(post.uid, ['username', 'picture'], callback);  
            },
            topic: function(callback) {
                Topics.getTopicFields(post.tid, ['title', 'slug'], callback);
            },
            category: function(callback) {
                Categories.getCategoryFields(post.cid, ['name'], callback);
            }
        }, function(err, data) {
            
            // trim message based on config option
            var maxContentLength = 1000;
            if (maxContentLength && content.length > maxContentLength) { content = content.substring(0, maxContentLength) + '...'; }
            // message format: <username> posted [<categoryname> : <topicname>]\n <message>
            var message = '<' + nconf.get('url') + '/topic/' + data.topic.slug + '|[' + data.category.name + ': ' + data.topic.title + ']>\n' + content;
            
						server.messages().send({
							to: 'kacper@catalytic.com',
							subject: 'New post',
							from: 'community@catalytic.com',
							html: '<span></span>',
							text: message
						}, function (err, body) {
							if (!err) {
								winston.verbose('[emailer.mailgun] Sent');
							} else {
								winston.warn('[emailer.mailgun] Unable to send.');
								winston.error('[emailer.mailgun] (' + err.message + ')');
							}

							return callback(err, data);
						});
        });
    }
};

Emailer.admin = {
	menu: function(custom_header, callback) {
		custom_header.plugins.push({
			"route": '/plugins/post-emailer',
			"icon": 'fa-envelope-o',
			"name": 'Post Emailer'
		});

		callback(null, custom_header);
	}
};

module.exports = Emailer;
