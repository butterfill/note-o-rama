# -*- coding: utf-8 -*-

from setuptools import setup, find_packages
from setuptools.command.build_py import build_py
from turbogears.finddata import find_package_data

import os

execfile(os.path.join("nrama2", "release.py"))

packages = find_packages()
package_data = find_package_data(where='nrama2',
    package='nrama2')
if os.path.isdir('locales'):
    packages.append('locales')
    package_data.update(find_package_data(where='locales',
        exclude=('*.po',), only_in_packages=False))

class build_py_and_kid(build_py):
    """Build pure Python modules and Kid templates."""

    def byte_compile(self, files):
        """Byte-compile all Python modules and all Kid templates."""
        build_py.byte_compile(self, files)
        kid_files = [f for f in files if f.endswith('.kid')]
        if not kid_files:
            return
        from distutils import log
        try:
            from kid.compiler import compile_file
        except ImportError:
            log.warn("Kid templates cannot be compiled,"
                " because Kid is not installed.")
            return
        if self.dry_run:
            return
        for kid_file in kid_files:
            if compile_file(kid_file, force=self.force):
                log.info("byte-compiling %s", kid_file)
            else:
                log.debug("skipping byte-compilation of %s", kid_file)

setup(
    name="nrama2",
    version=version,
    # uncomment the following lines if you fill them out in release.py
    #description=description,
    #long_descriptopn=long_description,
    #author=author,
    #author_email=email,
    #url=url,
    #download_url=download_url,
    #license=license,

    install_requires=[
        "TurboGears >= 1.0.9",
        "SQLObject>=0.10.1"
    ],
    zip_safe=False,
    packages=packages,
    package_data=package_data,
    keywords=[
        # Use keywords if you'll be adding your package to the
        # Python Cheeseshop

        # if this has widgets, uncomment the next line
        # 'turbogears.widgets',

        # if this has a tg-admin command, uncomment the next line
        # 'turbogears.command',

        # if this has identity providers, uncomment the next line
        # 'turbogears.identity.provider',

        # If this is a template plugin, uncomment the next line
        # 'python.templating.engines',

        # If this is a full application, uncomment the next line
        # 'turbogears.app',
    ],
    classifiers=[
        'Development Status :: 3 - Alpha',
        'Operating System :: OS Independent',
        'Programming Language :: Python',
        'Topic :: Software Development :: Libraries :: Python Modules',
        'Framework :: TurboGears',
        # if this is an application that you'll distribute through
        # the Cheeseshop, uncomment the next line
        # 'Framework :: TurboGears :: Applications',

        # if this is a package that includes widgets that you'll distribute
        # through the Cheeseshop, uncomment the next line
        # 'Framework :: TurboGears :: Widgets',
    ],
    test_suite='nose.collector',
    entry_points={
        'console_scripts': [
            'start-nrama2 = nrama2.commands:start',
        ],
    },
    cmdclass={
        'build_py': build_py_and_kid,
    }
    # Uncomment next line and create a default.cfg file in your project dir
    # if you want to package a default configuration in your egg.
    #data_files = [('config', ['default.cfg'])],
    )
