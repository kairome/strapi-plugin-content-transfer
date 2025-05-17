# Strapi plugin content-transfer

Content transfer plugin allows transferring individual entities between strapi instances, including media files,
relations and locales.

## Requirements

This version of the plugin supports **strapi v4**. Support for v5 is coming soon.

## Installation

```bash 
npm install strapi-plugin-content-transfer
```

or

```bash 
yarn add strapi-plugin-content-transfer
```

## Settings

The first step to transferring entities is to add the destination instance in settings.

Navigate to `/admin/settings/content-transfer/integrations`.


<div align="center">
  <img width="49%" src="https://github.com/user-attachments/assets/0cff4a25-022a-4b2e-a326-07e14f74fe81" />
  <img width="49%" src="https://github.com/user-attachments/assets/5fa47150-f8f3-4ba7-85e9-e893b6b06000" />
</div>


Here is the list of all the instances the plugin will be able to transfer to.
Each integration must have an instance url and a token.

Instance url must not contain any extra paths.
So for example, if your instance resides at `https://myinstance.mydomain.com/admin/`, the integration url must be `https://myinstance.mydomain.com`.

Token must be a full access token, with permission to read and write for all collections.
To generate such token, navigate to `/admin/settings/api-tokens/create` and select *Full access* in `Token type` field.

## How to transfer entities

Navigate to `/admin/plugins/content-transfer`. This is the main content transfer page.

1. Select your collection
<div align="center">
  <img src="https://github.com/user-attachments/assets/013cdabb-b20b-4086-aaa1-f993a1d4f125" />
</div>

2. Select entities you want to transfer
<div align="center">
  <img src="https://github.com/user-attachments/assets/19775d3e-7261-4b71-a699-586a989de44b" />
</div>

3. Choose options in the control box and select the target instance
<div align="center">
  <img src="https://github.com/user-attachments/assets/7bee8ca0-c136-47b3-8017-41f3fdc8d427" />
</div>

4. Press the button and wait for the transfer to finish
<div align="center">
  <img src="https://github.com/user-attachments/assets/63695f75-39bd-4959-9412-8476b7011aa5" />
</div>

## Transfer options

There are 3 additional transfer options that are turned off by default.
Each option adds additional transfer information for each entity, which increases the transfer time.

There are optimization techniques implemented for each option to cut down on transfer time.
The plugin will attempt to find existing media files, relations and locales on the target instance first, before creating the corresponding entities.

### Upload media

This option will upload the files in each entity to the target instance, in case it doesn't find them on the target instance.
The plugin will retrieve the list of all files on the target instance, and compare the file's name, width and height to match the media files to the source instance.

If this option is turned off, the comparison check will still run, and only already existing files on the target instance will be attached to the entities being transferred.

Files that the plugin uploads to the target instance can be found in the Media Library tab `/admin/plugins/upload`, inside the `API Uploads` folder.

### Create relations

This option will scan for all relations attached to the transfer entities, and create those related entities in the target instance.
Similarly to the media transfer, if this option is turned off, the plugin will still attach relations that already exist in the target instance.

Note, that this option will only create related entities if they don't already exist, it will not update them.
Also, the related entities will not be fully populated, i.e. information about media files, relations, components, dynamic zones and so on will not be transferred.
For that, you will have to transfer those related entities separately.

### Transfer locales

This option will attempt to transfer all locales connected to the transfer entity. The plugin will transfer only those locales that exist in the target instance.
So for example, if in the source instance you have German, French and Spanish locales, but on the target instance only German, then the plugin will only transfer the German locales.

To add more locales, visit `/admin/settings/internationalization`.

Unlike create relations option, transfer locales will fully create/update locale entities, including media files, relations, components, dynamic zones, etc.
It is also dependent on Upload media and Create relations options, i.e. it will mirror the transfer behavior for the default language entity, and *will not* create relations and upload media files if those options are turned off.

The transfer algorithm here is a bit more complex due to the nature of how the locales are implemented in strapi, more on that in the next section.

## How the transfer works

The plugin will first populate all fields, including nested ones, for each entity.
Then, depending on the options, it will retrieve/upload media files to the target instance.

After that, the plugin will attempt to create relations, including the localized ones.
For localized relations, the plugin will try to find the parent entity. If the parent entity doesn't exist, the plugin will create one in the target instance.
The reason for creating the parent entity in the default locale is that localized entities must be connected to a parent entity and between each other.
Otherwise, it won't be possible to switch between entity locales in strapi.
Then, the plugin will either update the locale relation or create one, connecting it to the parent entity.

The plugin also supports the transfer between instances where default locales differ.
In that case, the parent entities for relations will be filtered according to the default locale of the target instance.

Almost the same algorithm applies to transferring the entities themselves.
The search for entities in the target instance relies on the main field set for the collection.
This can be found in `Content-Type Builder > Your collection > Configure the view > Entry title`.
Make sure that main field for the collection is not marked private, otherwise the field won't show up in the api responses, thus the transfer will fail.
