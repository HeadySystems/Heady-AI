/**
 * Sacred Geometry constants and utilities for HeadyBuddy UI.
 * All numeric parameters are governed by phi (1.618033988749895).
 * (c) 2026 HeadySystems Inc. All Rights Reserved.
 */
package com.headysystems.headybuddy.ui.theme

import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.unit.TextUnit

object SacredGeometry {

    /** The golden ratio phi */
    const val PHI = 1.618033988749895f

    /** Inverse golden ratio (1/phi) */
    const val PHI_INVERSE = 0.6180339887498949f

    /** phi^2 */
    const val PHI_SQUARED = 2.618033988749895f

    /** phi^3 */
    const val PHI_CUBED = 4.23606797749979f

    /** phi^7 heartbeat interval */
    const val PHI_7_HEARTBEAT_MS = 29_034L

    // --- Fibonacci spacing scale (dp) ---
    val space1: Dp = 1.dp
    val space2: Dp = 2.dp
    val space3: Dp = 3.dp
    val space5: Dp = 5.dp
    val space8: Dp = 8.dp
    val space13: Dp = 13.dp
    val space21: Dp = 21.dp
    val space34: Dp = 34.dp
    val space55: Dp = 55.dp
    val space89: Dp = 89.dp

    // --- Fibonacci typography scale (sp) ---
    val textTiny: TextUnit = 8.sp
    val textSmall: TextUnit = 13.sp
    val textBody: TextUnit = 15.sp       // ~13 * PHI_INVERSE + base
    val textMedium: TextUnit = 18.sp
    val textLarge: TextUnit = 21.sp
    val textHeading: TextUnit = 26.sp    // ~21 * PHI_INVERSE + 13
    val textDisplay: TextUnit = 34.sp
    val textHero: TextUnit = 55.sp

    // --- Fibonacci corner radii ---
    val cornerSmall: Dp = 5.dp
    val cornerMedium: Dp = 8.dp
    val cornerLarge: Dp = 13.dp
    val cornerXLarge: Dp = 21.dp
    val cornerFull: Dp = 34.dp

    // --- Icon sizes (Fibonacci) ---
    val iconSmall: Dp = 13.dp
    val iconMedium: Dp = 21.dp
    val iconLarge: Dp = 34.dp
    val iconXLarge: Dp = 55.dp

    // --- Bubble dimensions ---
    val bubbleSize: Dp = 55.dp
    val bubbleExpandedWidth: Dp = 233.dp   // Fibonacci number
    val bubbleExpandedHeight: Dp = 377.dp  // Fibonacci number

    // --- Golden ratio helpers ---
    fun goldenMajor(total: Float): Float = total * PHI_INVERSE
    fun goldenMinor(total: Float): Float = total * (1f - PHI_INVERSE)

    /** Return a Fibonacci number by index (0-indexed: 0,1,1,2,3,5,8...) */
    fun fibonacci(n: Int): Long {
        if (n <= 0) return 0L
        if (n == 1) return 1L
        var a = 0L
        var b = 1L
        for (i in 2..n) {
            val c = a + b
            a = b
            b = c
        }
        return b
    }
}
