'use strict';

var winston = require('winston');
var fs = require('fs');
var nconf = require.main.require('nconf');
var db = module.parent.require('./database');
var qnLib = require('qn');
// var imagemin = require("imagemin");
// var imageminMozjpeg = require('imagemin-mozjpeg');
// var imageminPngquant = require('imagemin-pngquant');

(function (qn) {

	var settings;
	var qnClient;

	function reconstructQN() {
		qnClient = qnLib.create({
			accessKey: settings.accessKey,
			secretKey: settings.secretKey,
			bucket: settings.bucket,
			origin: settings.origin,
			// timeout: 3600000, // default rpc timeout: one hour, optional
			// if your app outside of China, please set `uploadURL` to `http://up.qiniug.com/`
			// uploadURL: 'http://up.qiniu.com/',
		});
	}

	db.getObject('nodebb-plugin-qn', function (err, _settings) {
		if (err) {
			return winston.error(err.message);
		}
		settings = _settings || {};
		if (settings.accessKey) {
			reconstructQN();
		}

	});

	qn.init = function (params, callback) {
		params.router.get('/admin/plugins/qn', params.middleware.applyCSRF, params.middleware.admin.buildHeader, renderAdmin);
		params.router.get('/api/admin/plugins/qn', params.middleware.applyCSRF, renderAdmin);

		params.router.post('/api/admin/plugins/qn/save', params.middleware.applyCSRF, save);
		winston.verbose("[plugins]nodebb-plugin-qn init done.");

		callback();
	};

	function renderAdmin(req, res, next) {
		var data = {
			accessKey: settings.accessKey,
			secretKey: settings.secretKey,
			bucket: settings.bucket,
			origin: settings.origin
		};
		res.render('admin/plugins/qn', {
			settings: data,
			csrf: req.csrfToken()
		});
	}

	function save(req, res, next) {
		var data = {
			accessKey: req.body.accessKey || '',
			secretKey: req.body.secretKey || '',
			bucket: req.body.bucket || '',
			origin: req.body.origin || ''
		};

		db.setObject('nodebb-plugin-qn', data, function (err) {
			if (err) {
				return next(err);
			}

			settings.accessKey = data.accessKey;
			settings.secretKey = data.secretKey;
			settings.bucket = data.bucket;
			settings.origin = data.origin;
			reconstructQN();
			res.status(200).json({
				message: 'Settings saved!'
			});
		});
	}

	qn.upload = function (data, callback) {

		if (!settings.accessKey) {
			return callback(new Error('invalid qiniu accessKey'));
		}

		var image = data.image;
		if (!image) {
			return callback(new Error('invalid image'));
		}

		var type = image.url ? 'url' : 'file';
		if (type === 'file' && !image.path) {
			return callback(new Error('invalid image path'));
		}
		console.log("data:", data);
		console.log("image:", image);
		if (type === 'file') {
			//此处处理图片 压缩后再上传
					// console.log("压缩前大小:％d 字节", image.size); //字节
					// imagemin([image.path], '/tmp/images', {
					// 	use: [
					// 		imageminMozjpeg(),
					// 		imageminPngquant({
					// 			quality: '65-80'
					// 		})
					// 	]
					// }).then(function(files){
					// 	console.log(files);
          //   var buffer = files[0].data;
          //   var path = files[0].path;
          //   var buff_size = Buffer.byteLength(buffer);
          //   console.log("压缩后大小: %d 字节",buff_size);
          //   console.log("压缩比例:",Math.floor(image.size*100/buff_size)/100);
          //   qnClient.upload(buffer,function (err, result) {
          //     if (err) {
          //       winston.error(err);
          //       callback(new Error('Qiniu Upload failure.'));
          //     } else {
          //       return callback(null, {
          //         name: image.name,
          //         url: "//" + result.url
          //       });
          //     }
          //   });
					//
        	// });

			qnClient.uploadFile(image.path, function (err, result) {
				if (err) {
					winston.error(err);
					callback(new Error('Qiniu Upload failure.'));
				} else {
					return callback(null, {
						name: image.name,
						url: "//" + result.url+"?imageMogr2/quality/40"
					});
				}
			});

		} else if (type === 'url') {
      console.log("七牛上传图片程序默认不会走到这里＝＝＝＝＝");
			qnClient.upload(image.url, function (err, result) {
				if (err) {
					winston.error(err);
					callback(new Error('Qiniu Upload failure.'));
				} else {
					return callback(null, {
						name: image.name,
						url: result.url.replace('http:', 'https:')
					});
				}
			});
		} else {
			return callback(new Error('unknown-type'));
		}
	};

	var admin = {};

	admin.menu = function (menu, callback) {
		menu.plugins.push({
			route: '/plugins/qn',
			icon: 'fa-cloud-upload',
			name: 'Qiniu'
		});

		callback(null, menu);
	};


	qn.admin = admin;

}(module.exports));
