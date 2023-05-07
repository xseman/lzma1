SHELL=/bin/bash
ESMDIR=./lib/esm
CJSDIR=./lib/cjs

all: clean build

clean:
	rm -rf ./lib

build:
	-npx tsc --emitDeclarationOnly --outDir ./lib
	npx esbuild ./lzma.ts --format=esm --platform=neutral --outdir=$(ESMDIR)
	npx esbuild ./lzma.ts --format=cjs --platform=neutral --outdir=$(CJSDIR)

	echo '{ "type": "commonjs" }' > $(CJSDIR)/package.json
	echo '{ "type": "module" }'   > $(ESMDIR)/package.json

version:
	git commit -am ${npm_package_version}

release:
	git flow release start v${npm_package_version}
