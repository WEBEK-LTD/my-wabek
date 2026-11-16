<?php
/**
 * Compiles a gettext .po file into a .mo file (msgfmt replacement).
 *
 * Usage: php po2mo.php <file.po> [<file.mo>]
 *
 * Supports msgctxt, msgid_plural / msgstr[n] and multi-line strings; skips
 * fuzzy and untranslated entries. Dev tool only; not shipped in the zip.
 */

if ( PHP_SAPI !== 'cli' ) {
	exit( 1 );
}

$po = isset( $argv[1] ) ? $argv[1] : '';
$mo = isset( $argv[2] ) ? $argv[2] : preg_replace( '/\.po$/', '.mo', $po );
if ( '' === $po || ! is_readable( $po ) ) {
	fwrite( STDERR, "Usage: php po2mo.php <file.po> [<file.mo>]\n" );
	exit( 1 );
}

/**
 * Unquotes one PO string line.
 *
 * @param string $line Quoted line.
 * @return string
 */
function wabek_mo_unquote( $line ) {
	$line = trim( $line );
	if ( '"' !== substr( $line, 0, 1 ) || '"' !== substr( $line, -1 ) ) {
		return '';
	}
	return stripcslashes( substr( $line, 1, -1 ) );
}

$entries = array();
$entry   = array();
$field   = null;
$fuzzy   = false;

$flush = static function () use ( &$entries, &$entry, &$fuzzy ) {
	if ( isset( $entry['msgid'] ) && ! $fuzzy ) {
		$entries[] = $entry;
	}
	$entry = array();
	$fuzzy = false;
};

foreach ( file( $po ) as $raw ) {
	$line = rtrim( $raw, "\r\n" );
	if ( '' === trim( $line ) ) {
		$flush();
		$field = null;
		continue;
	}
	if ( 0 === strpos( $line, '#,' ) && false !== strpos( $line, 'fuzzy' ) ) {
		$fuzzy = true;
		continue;
	}
	if ( '#' === $line[0] ) {
		continue;
	}
	if ( preg_match( '/^(msgctxt|msgid_plural|msgid|msgstr(?:\[(\d+)\])?)\s+(".*")$/', $line, $m ) ) {
		if ( 'msgid' === $m[1] && isset( $entry['msgid'] ) ) {
			$flush();
		}
		$field           = $m[1];
		$entry[ $field ] = wabek_mo_unquote( $m[3] );
		continue;
	}
	if ( null !== $field && '"' === substr( ltrim( $line ), 0, 1 ) ) {
		$entry[ $field ] .= wabek_mo_unquote( $line );
	}
}
$flush();

$table = array();
foreach ( $entries as $e ) {
	$key = ( isset( $e['msgctxt'] ) ? $e['msgctxt'] . "\x04" : '' ) . $e['msgid'];
	if ( isset( $e['msgid_plural'] ) ) {
		$key  .= "\0" . $e['msgid_plural'];
		$forms = array();
		for ( $n = 0; isset( $e[ 'msgstr[' . $n . ']' ] ); $n++ ) {
			$forms[] = $e[ 'msgstr[' . $n . ']' ];
		}
		if ( ! $forms || '' === implode( '', $forms ) ) {
			continue;
		}
		$value = implode( "\0", $forms );
	} else {
		$value = isset( $e['msgstr'] ) ? $e['msgstr'] : '';
		if ( '' === $value ) {
			continue;
		}
	}
	$table[ $key ] = $value;
}
ksort( $table, SORT_STRING );

$count     = count( $table );
$orig_off  = 28;
$trans_off = $orig_off + 8 * $count;
$data_off  = $trans_off + 8 * $count;
$originals = '';
$translats = '';
$o_index   = '';
$t_index   = '';
$keys      = array_keys( $table );

foreach ( $keys as $key ) {
	$o_index   .= pack( 'VV', strlen( $key ), $data_off + strlen( $originals ) );
	$originals .= $key . "\0";
}
$trans_base = $data_off + strlen( $originals );
foreach ( $keys as $key ) {
	$t_index   .= pack( 'VV', strlen( $table[ $key ] ), $trans_base + strlen( $translats ) );
	$translats .= $table[ $key ] . "\0";
}

$bin = pack( 'V*', 0x950412de, 0, $count, $orig_off, $trans_off, 0, $data_off ) . $o_index . $t_index . $originals . $translats;
file_put_contents( $mo, $bin );
echo "Compiled {$count} strings to {$mo}\n";
