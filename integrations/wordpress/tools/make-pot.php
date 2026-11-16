<?php
/**
 * Generates languages/wabek-whatsapp.pot from the plugin sources.
 *
 * Usage: php make-pot.php <plugin-dir>
 *
 * A dependency-free alternative to `wp i18n make-pot`: it tokenizes every PHP
 * file and collects calls to the WordPress gettext functions that use the
 * `wabek-whatsapp` text domain, with translator comments and references.
 * Dev tool only; it is not shipped inside the plugin zip.
 */

if ( PHP_SAPI !== 'cli' ) {
	exit( 1 );
}

$dir    = isset( $argv[1] ) ? rtrim( $argv[1], '/' ) : '';
$domain = 'wabek-whatsapp';
if ( '' === $dir || ! is_dir( $dir ) ) {
	fwrite( STDERR, "Usage: php make-pot.php <plugin-dir>\n" );
	exit( 1 );
}

// function => [ argument roles ] (s = singular, p = plural, c = context, n = number, d = domain).
$functions = array(
	'__'         => array( 's', 'd' ),
	'_e'         => array( 's', 'd' ),
	'esc_html__' => array( 's', 'd' ),
	'esc_html_e' => array( 's', 'd' ),
	'esc_attr__' => array( 's', 'd' ),
	'esc_attr_e' => array( 's', 'd' ),
	'_x'         => array( 's', 'c', 'd' ),
	'_n'         => array( 's', 'p', 'n', 'd' ),
	'_nx'        => array( 's', 'p', 'n', 'c', 'd' ),
);

/**
 * Decodes a PHP string literal token without evaluating code.
 *
 * @param string $token Literal including quotes.
 * @return string|null
 */
function wabek_pot_literal( $token ) {
	$quote = $token[0];
	$body  = substr( $token, 1, -1 );
	if ( "'" === $quote ) {
		return strtr( $body, array( "\\'" => "'", '\\\\' => '\\' ) );
	}
	if ( '"' === $quote ) {
		if ( preg_match( '/(?<!\\\\)\$/', $body ) ) {
			return null; // Interpolated: not translatable.
		}
		return strtr( $body, array( '\\n' => "\n", '\\t' => "\t", '\\"' => '"', '\\\\' => '\\', '\\$' => '$' ) );
	}
	return null;
}

/**
 * Escapes a string for a PO file, splitting multi-line strings.
 *
 * @param string $text Text.
 * @return string
 */
function wabek_pot_quote( $text ) {
	$escaped = strtr( $text, array( '\\' => '\\\\', '"' => '\\"', "\t" => '\\t' ) );
	if ( false === strpos( $text, "\n" ) ) {
		return '"' . $escaped . '"';
	}
	$parts = explode( "\n", $escaped );
	$last  = array_pop( $parts );
	$out   = "\"\"\n";
	foreach ( $parts as $part ) {
		$out .= '"' . $part . "\\n\"\n";
	}
	if ( '' !== $last ) {
		$out .= '"' . $last . "\"\n";
	}
	return rtrim( $out, "\n" );
}

$entries = array();
$iter    = new RecursiveIteratorIterator( new RecursiveDirectoryIterator( $dir, FilesystemIterator::SKIP_DOTS ) );
$files   = array();
foreach ( $iter as $file ) {
	if ( 'php' === $file->getExtension() ) {
		$files[] = $file->getPathname();
	}
}
sort( $files );

foreach ( $files as $path ) {
	$rel     = ltrim( substr( $path, strlen( $dir ) ), '/' );
	$tokens  = token_get_all( file_get_contents( $path ) );
	$count   = count( $tokens );
	$comment = '';
	for ( $i = 0; $i < $count; $i++ ) {
		$tok = $tokens[ $i ];
		if ( is_array( $tok ) && in_array( $tok[0], array( T_COMMENT, T_DOC_COMMENT ), true ) && false !== stripos( $tok[1], 'translators:' ) ) {
			$comment = trim( preg_replace( '#^\s*(/\*+|//|\*/|\*)\s?#m', '', $tok[1] ) );
			$comment = trim( preg_replace( '/\s+/', ' ', str_replace( '*/', '', $comment ) ) );
			continue;
		}
		if ( ! is_array( $tok ) || T_STRING !== $tok[0] || ! isset( $functions[ $tok[1] ] ) ) {
			continue;
		}
		// Skip method calls / declarations.
		$prev = $i - 1;
		while ( $prev >= 0 && is_array( $tokens[ $prev ] ) && T_WHITESPACE === $tokens[ $prev ][0] ) {
			--$prev;
		}
		if ( $prev >= 0 && is_array( $tokens[ $prev ] ) && in_array( $tokens[ $prev ][0], array( T_OBJECT_OPERATOR, T_DOUBLE_COLON, T_FUNCTION ), true ) ) {
			continue;
		}
		$line = $tok[2];
		$j    = $i + 1;
		while ( $j < $count && is_array( $tokens[ $j ] ) && T_WHITESPACE === $tokens[ $j ][0] ) {
			++$j;
		}
		if ( '(' !== $tokens[ $j ] ) {
			continue;
		}
		// Collect top-level arguments as literal strings (null when not a literal).
		$args  = array();
		$depth = 0;
		$cur   = array();
		for ( $k = $j + 1; $k < $count; $k++ ) {
			$t = $tokens[ $k ];
			if ( '(' === $t || '[' === $t ) {
				++$depth;
			} elseif ( ')' === $t || ']' === $t ) {
				if ( 0 === $depth ) {
					$args[] = $cur;
					break;
				}
				--$depth;
			} elseif ( ',' === $t && 0 === $depth ) {
				$args[] = $cur;
				$cur    = array();
				continue;
			}
			if ( ! ( is_array( $t ) && in_array( $t[0], array( T_WHITESPACE, T_COMMENT ), true ) ) ) {
				$cur[] = $t;
			}
		}
		$roles = $functions[ $tok[1] ];
		$data  = array();
		foreach ( $roles as $index => $role ) {
			if ( 'n' === $role ) {
				continue;
			}
			$arg = isset( $args[ $index ] ) ? $args[ $index ] : array();
			if ( 1 !== count( $arg ) || ! is_array( $arg[0] ) || T_CONSTANT_ENCAPSED_STRING !== $arg[0][0] ) {
				$data = null;
				break;
			}
			$data[ $role ] = wabek_pot_literal( $arg[0][1] );
		}
		if ( ! $data || ! isset( $data['d'] ) || $domain !== $data['d'] || null === $data['s'] ) {
			$comment = '';
			continue;
		}
		$key = ( isset( $data['c'] ) ? $data['c'] . "\x04" : '' ) . $data['s'];
		if ( ! isset( $entries[ $key ] ) ) {
			$entries[ $key ] = array(
				'data'     => $data,
				'refs'     => array(),
				'comments' => array(),
			);
		}
		$entries[ $key ]['refs'][] = $rel . ':' . $line;
		if ( '' !== $comment ) {
			$entries[ $key ]['comments'][ $comment ] = true;
		}
		$comment = '';
	}
}

// Plugin header strings.
$main    = file_get_contents( $dir . '/wabek-whatsapp.php' );
$headers = array();
foreach ( array( 'Plugin Name', 'Description' ) as $header ) {
	if ( preg_match( '/^\s*\*\s*' . preg_quote( $header, '/' ) . ':\s*(.+)$/m', $main, $m ) ) {
		$headers[ $header ] = trim( $m[1] );
	}
}
$version = preg_match( '/^\s*\*\s*Version:\s*(.+)$/m', $main, $m ) ? trim( $m[1] ) : '';

$out  = "# Copyright (C) " . gmdate( 'Y' ) . " webek.org\n";
$out .= "# This file is distributed under the WABEK proprietary license.\n";
$out .= "msgid \"\"\nmsgstr \"\"\n";
$out .= '"Project-Id-Version: WABEK WhatsApp for WooCommerce ' . $version . "\\n\"\n";
$out .= "\"Report-Msgid-Bugs-To: https://waabek.com\\n\"\n";
$out .= "\"MIME-Version: 1.0\\n\"\n";
$out .= "\"Content-Type: text/plain; charset=UTF-8\\n\"\n";
$out .= "\"Content-Transfer-Encoding: 8bit\\n\"\n";
$out .= "\"Language-Team: webek.org\\n\"\n";
$out .= "\"X-Domain: wabek-whatsapp\\n\"\n\n";

foreach ( $headers as $header => $value ) {
	$out .= "#. {$header} of the plugin\n#: wabek-whatsapp.php\nmsgid " . wabek_pot_quote( $value ) . "\nmsgstr \"\"\n\n";
}
foreach ( $entries as $entry ) {
	foreach ( array_keys( $entry['comments'] ) as $comment ) {
		$out .= '#. ' . $comment . "\n";
	}
	$out .= '#: ' . implode( ' ', array_unique( $entry['refs'] ) ) . "\n";
	if ( false !== strpos( $entry['data']['s'], '%' ) ) {
		$out .= "#, php-format\n";
	}
	if ( isset( $entry['data']['c'] ) ) {
		$out .= 'msgctxt ' . wabek_pot_quote( $entry['data']['c'] ) . "\n";
	}
	$out .= 'msgid ' . wabek_pot_quote( $entry['data']['s'] ) . "\n";
	if ( isset( $entry['data']['p'] ) ) {
		$out .= 'msgid_plural ' . wabek_pot_quote( $entry['data']['p'] ) . "\nmsgstr[0] \"\"\nmsgstr[1] \"\"\n\n";
	} else {
		$out .= "msgstr \"\"\n\n";
	}
}

$target = $dir . '/languages/wabek-whatsapp.pot';
file_put_contents( $target, rtrim( $out ) . "\n" );
echo 'Wrote ' . ( count( $entries ) + count( $headers ) ) . " strings to {$target}\n";
