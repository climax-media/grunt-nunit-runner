var expect = require('expect.js'),
nunit = require('../tasks/nunit.js'),
path = require('path');

describe('nunit', function() {

    it('should find a default assembly', function() {

        var assemblies = nunit.findTestAssemblies(['test/Data/Solution/Solution.sln']);
        expect(assemblies.length).to.be(1);
        expect(assemblies[0]).to.be(path.normalize('test/Data/Solution/bin/Debug/Project.ClassLibrary.dll'));

    });

    it('should find the assemblies matching your configuration', function() {

        var assemblies = nunit.findTestAssemblies(['test/Data/Solution/Solution.sln'], { config: 'debug' });
        expect(assemblies.length).to.be(1);
        expect(assemblies[0]).to.be(path.normalize('test/Data/Solution/bin/Debug/Project.ClassLibrary.dll'));

    });

    it('should find no assemblies when matching your bad configuration', function() {

        expect(function () {
          nunit.findTestAssemblies(['test/Data/Solution/Solution.sln'], { config: 'release' });
        }).throwError();

    });

    it('should detect exe name correctly', function() {

        expect(nunit.buildCommand(['asm.dll'], { version: 3, platform: 'x86' }).path).to.be('nunit3-console.exe');
        expect(nunit.buildCommand(['asm.dll'], { version: 3, platform: 'x64' }).path).to.be('nunit3-console.exe');
        expect(nunit.buildCommand(['asm.dll'], { version: 3 }).path).to.be('nunit3-console.exe');
        
        expect(nunit.buildCommand(['asm.dll'], { version: 2, platform: 'x86' }).path).to.be('nunit-console-x86.exe');
        expect(nunit.buildCommand(['asm.dll'], { version: 2, platform: 'x64' }).path).to.be('nunit-console.exe');
        expect(nunit.buildCommand(['asm.dll'], { version: 2 }).path).to.be('nunit-console.exe');
        
        expect(nunit.buildCommand(['asm.dll'], { platform: 'x86' }).path).to.be('nunit-console-x86.exe');
        expect(nunit.buildCommand(['asm.dll'], { platform: 'x64' }).path).to.be('nunit-console.exe');
        expect(nunit.buildCommand(['asm.dll'], {}).path).to.be('nunit-console.exe');
        
    });
    

    it('should detect arch correctly', function() {
      
        expect(nunit.buildCommand(['asm.dll'], { version: 3, platform: 'x86' }).args).to.contain('/x86');
        expect(nunit.buildCommand(['asm.dll'], { version: 3, platform: 'x64' }).args).to.not.contain('/x86');
        expect(nunit.buildCommand(['asm.dll'], { version: 3 }).args).to.not.contain('/x86');
        
        expect(nunit.buildCommand(['asm.dll'], { version: 2, platform: 'x86' }).args).to.not.contain('/x86');
        expect(nunit.buildCommand(['asm.dll'], { version: 2, platform: 'x64' }).args).to.not.contain('/x86');
        expect(nunit.buildCommand(['asm.dll'], { version: 2 }).args).to.not.contain('/x86');
        
        expect(nunit.buildCommand(['asm.dll'], { platform: 'x86' }).args).to.not.contain('/x86');
        expect(nunit.buildCommand(['asm.dll'], { platform: 'x64' }).args).to.not.contain('/x86');
        expect(nunit.buildCommand(['asm.dll'], {}).args).to.not.contain('/x86');
        
    });
    
    it('should append path corrctly', function() {
      
        expect(nunit.buildCommand(['asm.dll'], { path: 'testPath\\testPath' }).path).to.contain('testPath' + path.sep + 'testPath');
        expect(nunit.buildCommand(['asm.dll'], { path: 'testPath' + path.sep + 'testPath' }).path).to.contain('testPath' + path.sep + 'testPath');
        expect(nunit.buildCommand(['asm.dll'], {}).path).to.be('nunit-console.exe');
        
    });
});