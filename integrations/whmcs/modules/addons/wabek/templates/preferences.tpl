{* WABEK — WhatsApp preferences. Shim loaded by WHMCS (templatefile "preferences"): includes the theme's variant
   from $wabekTplDir (absolute path to templates/bs3, templates/bs4 or templates/lagom2, set by ClientController),
   or the Bootstrap 4 set when the variable is missing. *}
{if $wabekTplDir}{include file="`$wabekTplDir`/preferences.tpl"}{else}{include file="./bs4/preferences.tpl"}{/if}
