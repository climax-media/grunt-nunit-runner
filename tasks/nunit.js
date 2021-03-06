var fs = require('fs'),
    path = require('path'),
    _ = require('lodash'),
    msbuild = require('./msbuild.js'),
    sax = require('sax');

exports.findTestAssemblies = function(files, options) {
    var assemblies = [];
    var projects = [];
    files.forEach(function(file) {
        switch(path.extname(file)) {
            case '.sln': projects = projects.concat(msbuild.getSolutionProjectInfo(file)); break;
            case '.csproj': projects.push(msbuild.getProjectInfo(file)); break;
            default: {
                if (!fs.existsSync(file)) throw new Error('Assembly not found: ' + file);
                assemblies.push(path.normalize(file));
            }
        }
    });

    projects.
        filter(function(project) { return _.includes(project.references, 'nunit.framework'); }).
        forEach(function(project) {
            var outputs = project.output.filter(function(output) { return fs.existsSync(output); });
            if (outputs.length === 0) throw new Error('No assemblies exist for project: ' + project.path);

            if (options && options.config) {
                outputs = outputs.filter(function(output) {
                    return output.toLowerCase().indexOf(options.config.toLowerCase()) > -1;
                });
            }

            if (outputs.length === 0) throw new Error('No assemblies exist for project matching config parameter: ' + project.path);
            assemblies.push(path.normalize(outputs[0]));
        });
    return assemblies;
};

exports.buildCommand = function(assemblies, options) {

    var nunit = '';
    var args = assemblies.map(function(assembly) { return '"' + assembly + '"'; });

    options.result = 'TestResult.xml';

    if(!options.version || options.version < 3) {
        nunit = options.platform === 'x86' ? 'nunit-console-x86.exe' : 'nunit-console.exe';
        options.resultFormat = '';
    } else {
        nunit = 'nunit3-console.exe';

        if (options.platform === 'x86') args.push('/x86');

        options.resultFormat = 'nunit2';
    }

    if (options.path) nunit = path.join(options.path, nunit);

    nunit = nunit.replace(/\\/g, path.sep);


    if (options.run && options.run.length > 0) args.push('/run:"' + options.run.join(',') + '"');
    if (options.runlist) args.push('/runlist:"' + options.runlist + '"');
    if (options.config) args.push('/config:"' + options.config + '"');
    if (options.result) args.push('/result:' + options.result + (options.resultFormat ? ';format=' + options.resultFormat : ''));
    if (options.noresult) args.push('/noresult');
    if (options.output) args.push('/output:"' + options.output + '"');
    if (options.err) args.push('/err:' + options.err + '');
    if (options.work) args.push('/work:"' + options.work + '"');
    if (options.labels) args.push('/labels');
    if (options.trace) args.push('/trace:' + options.trace);
    if (options.include && options.include.length > 0) args.push('/include:"' + options.include.join(',') + '"');
    if (options.exclude && options.exclude.length > 0) args.push('/exclude:"' + options.exclude.join(',') + '"');
    if (options.framework) args.push('/framework:"' + options.framework + '"');
    if (options.process) args.push('/process:' + options.process);
    if (options.domain) args.push('/domain:' + options.domain);
    if (options.apartment) args.push('/apartment:' + options.apartment);
    if (options.noshadow) args.push('/noshadow');
    if (options.nothread) args.push('/nothread');
    if (options.basepath) args.push('/basepath:"' + options.basepath + '"');
    if (options.privatebinpath && options.privatebinpath.length > 0) args.push('/privatebinpath:"' + options.privatebinpath.join(';') + '"');
    if (options.timeout) args.push('/timeout:' + options.timeout);
    if (options.wait) args.push('/wait');
    if (options.nologo) args.push('/nologo');
    if (options.nodots) args.push('/nodots');
    if (options.stoponerror) args.push('/stoponerror');
    if (options.cleanup) args.push('/cleanup');

    return {
        path: nunit,
        args: args
    };
};

exports.createTeamcityLog = function(results) {

    var parser = sax.parser(true);
    var log = [];
    var ancestors = [];
    var message, stackTrace;

    var getSuiteName = function(node) { return node.attributes.type === 'Assembly' ?
        path.basename(node.attributes.name.replace(/\\/g, path.sep)) : node.attributes.name; };

    parser.onopentag = function (node) {
        ancestors.push(node);
        switch (node.name) {
            case 'test-suite': log.push('##teamcity[testSuiteStarted name=\'' + getSuiteName(node) + '\']'); break;
            case 'test-case':
                if (node.attributes.executed === 'True') log.push('##teamcity[testStarted name=\'' + node.attributes.name + '\']');
                message = '';
                stackTrace = '';
                break;
        }
    };

    parser.oncdata = function (data) {
        data = data.
            replace(/\|/g, '||').
            replace(/\'/g, '|\'').
            replace(/\n/g, '|n').
            replace(/\r/g, '|r').
            replace(/\u0085/g, '|x').
            replace(/\u2028/g, '|l').
            replace(/\u2029/g, '|p').
            replace(/\[/g, '|[').
            replace(/\]/g, '|]');

        switch (_.last(ancestors).name) {
            case 'message': message += data; break;
            case 'stack-trace': stackTrace += data; break;
        }
    };

    parser.onclosetag = function (node) {
        node = ancestors.pop();
        switch (node.name) {
            case 'test-suite': log.push('##teamcity[testSuiteFinished name=\'' + getSuiteName(node) + '\']'); break;
            case 'test-case':
                if (node.attributes.result === 'Ignored')
                    log.push('##teamcity[testIgnored name=\'' + node.attributes.name + '\'' +
                        (message ? ' message=\'' + message + '\'' : '') + ']');
                else if (node.attributes.executed === 'True') {
                    if (node.attributes.success === 'False') {
                        log.push('##teamcity[testFailed name=\'' + node.attributes.name + '\'' +
                            (message ? ' message=\'' + message + '\'' : '') +
                            (stackTrace ? ' details=\'' + stackTrace + '\'' : '') + ']');
                    }
                    var duration = node.attributes.time ? ' duration=\'' + parseInt(
                        node.attributes.time.replace(/[\.\:]/g, '')) + '\'' : '';
                    log.push('##teamcity[testFinished name=\'' + node.attributes.name + '\'' + duration + ']');
                }
                break;
        }
    };

    parser.write(fs.readFileSync(results, 'utf8')).close();

    return log;
};

exports.parseErrors = function(results) {

    var parser = sax.parser(true);
    var log = [];
    var ancestors = [];
    var message, stackTrace;
    var testSuite = '';

    var getSuiteName = function(node) { return node.attributes.type === 'Assembly' ?
        path.basename(node.attributes.name.replace(/\\/g, path.sep)) : node.attributes.name; };

    parser.onopentag = function (node) {
        ancestors.push(node);
        switch (node.name) {
            case 'test-suite':
                testSuite = getSuiteName(node);
                break;
            case 'test-case':
                message = '';
                stackTrace = '';
                break;
        }
    };

    parser.oncdata = function (data) {
        data = data.
            replace(/\|/g, '||').
            replace(/\'/g, '|\'').
            replace(/\n/g, '').
            replace(/\r/g, '').
            replace(/\u0085/g, '|x').
            replace(/\u2028/g, '|l').
            replace(/\u2029/g, '|p').
            replace(/\[/g, '|[').
            replace(/\]/g, '|]');

        switch (_.last(ancestors).name) {
            case 'message': message += data; break;
            case 'stack-trace': stackTrace += data; break;
        }
    };

    parser.onclosetag = function (node) {
        node = ancestors.pop();
        switch (node.name) {
            case 'test-suite':
                testSuite = '';
                break;
            case 'test-case':
                if (node.attributes.executed === 'True' && node.attributes.success === 'False') {
                    var testClassName = testSuite;
                    var idx2 = node.attributes.name.lastIndexOf('.');
                    var methodName = node.attributes.name.substring(idx2+1);
                    var idx3 = node.attributes.name.length - (testClassName + '.' + methodName).length-1;
                    var namespace = node.attributes.name.substring(0, idx3);



                    log.push(   'Test Namespace:  \'' + namespace + '\'' +
                            '\r\nTest Class:      \'' + testClassName + '\'' +
                            '\r\nTest Name:       \'' + methodName + '\'' +
                            (message ? '\r\nMessage:         \'' + message + '\'' : '') +
                            (stackTrace ? '\r\nDetails:         \'' + stackTrace + '\'' : ''));
                }
                break;
        }
    };

    parser.write(fs.readFileSync(results, 'utf8')).close();

    return log;
};
