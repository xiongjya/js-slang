# js-slang

Open-source implementations of the programming language _Source_. Source is a series of small subsets of JavaScript, designed for teaching university-level programming courses for computer science majors, following Structure and Interpretation of Computer Programs, JavaScript Adaptation (<https://sourceacademy.org/sicpjs/>).

## Table of Contents

- [Prerequisites](#prerequisites)
- [Usage](#usage)
- [Documentation](#documentation)
- [Requirements](#requirements)
- [Testing](#testing)
- [Error messages](#error-messages)
- [Using your js-slang in Source Academy](#using-your-js-slang-in-source-academy)
- [Using your js-slang in your local Source Academy](#using-your-js-slang-in-your-local-source-academy)
- [Building and publishing SICP package](#building-and-publishing-sicp-package)
- [Talks and Presentations](#talks-and-presentations)
- [License](#license)

## Prerequisites

- NodeJS v20
- Python: On MacBook Pro with chip Apple M1 Pro, use python 3.10.12. Here is [the correct way to set Python 3 as default on a Mac](https://opensource.com/article/19/5/python-3-default-mac).

## Usage

To build,

```bash
$ git clone --recurse-submodules https://github.com/xiongjya/js-slang.git
$ cd js-slang
$ yarn
$ yarn build
```

This repository uses git submodules. To update existing repositories with a submodule,

```bash
# Init is only required on the very first time.
$ git submodule update --init --recursive
# Required subsequently every time you want to update the submodules.
$ git submodule update --recursive --remote
```

## Testing

```bash
$ yarn test
```

## Using your js-slang in Source Academy

js-slang is used by the [Source Academy](https://sourceacademy.org), the immersive online experiential environment for learning programming. For this, js-slang is [deployed as an NPM package](https://www.npmjs.com/package/js-slang). The frontend of the Source Academy then includes the js-slang package in its deployment bundle.

## Using your js-slang in your local Source Academy

A common issue when developing modifications to js-slang is how to test it using your own local frontend. Assume that you have built your own frontend locally, here is how you can make it use your own js-slang, instead of the one that the Source Academy team has deployed to npm.

First, build and link your local js-slang:

```bash
$ cd js-slang
$ yarn build
$ yarn link
```

Then, from your local copy of frontend:

```bash
$ cd frontend
$ yarn link "js-slang"
```

Then start the frontend and the new js-slang will be used.

## Building and publishing SICP package

To build SICP package

```bash
$ cd js-slang
$ yarn
$ yarn build_sicp_package
```

To publish SICP package, update version number in `sicp_publish/package.json`

```bash
$ cd js-slang/sicp_publish
$ npm publish
```

## License

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

All sources in this repository are licensed under the [Apache License Version 2][apache2].

[apache2]: https://www.apache.org/licenses/LICENSE-2.0.txt
