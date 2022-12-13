
# Public Folders

Public Folders is a Home Assistant (HA) addon that can be used to serve HA directories directly via HTTP without needing to authorize the request though HA. This allows you to either use HA as a quick and dirty webserver for HTML files or allow access to media files for devices that do not support authorization.


# Configuration

## Basic Configuration:

**folders:** This is a list of locations that Public Folders will serve. 

    - url: media
      path: /media/public
    - url: music
      path: /media/music

The above example will add 2 locations to public folders ***http://\<HA URL\>:\<port\>\\media*** & ***http://\<HA URL\>:\<port\>\\music*** each one will serve the path specified.

It is also useful to note that location URL's can also be paths, for example if I wanted to host my Metalica playlist at ***http://\<HA URL\>:\<port\>\\music\metalica*** I would use.

      - url: music/metalica
        path: /media/music/metalica/black_album

In instances where you wish to use Public Folders to serve as a basic HTML website, you can set the URL of a location to \*, this will serve a path directly at ***http://\<HA URL\>:\<port\>*** without any additional path on the URL.

      - url: *
        path: /media/webroot

## Advanced Configuration

### Advanced Options:

**Index:** When a directory is being served and a file on this list exists within that directory, it will be served instead of a directory listing or a 404 response.

**directory_listing:** If set to true, users can browse the files and folders within a given location.
**key:** Path to the key file or pem file for https
**cert:** Path to the cert file or pem file for https

**request_logging:** If set to true, the Public Folders will create logs at locations visited, and files served to the addons log, this is useful information for debugging.

### Custom Error Pages:

Public Folders allows you to configure custom error pages for 401, 403 & 404 error codes.

**page_401:**  The path of the file or directory to be used when displaying 401  Error.

**page_403:** The path of the file or directory to be used when displaying 403  Forbidden.

**page_404:** The path of the file or directory to be used when displaying 401  Not Found.

402 is also supported but not currently used anywhere in the addon.

### Advanced Location Settings:

Each setting can be overridden per location.

      - url: music/metalica
        path: /media/music/metalica/black_album
        directory_listing: true
        request_logging: false

In the above example *directory_listing* is enabled for this location.

### Inheritance:

Each location by default copies its settings from the global configuration by default this is known as its inheritance.

**inherits:** (*default=global)* This is an array of location URL's to inherit settings, setting this to *none* will disable inheritance and setting this to *global* will inherit from the main configuration. Settings will be inherited in the same order of the array and once defined a setting will not be overridden by inheritance. Settings that use an array such as *index* will be merged with all inherited locations.