/**
 * HeadyBuddy Material 3 Theme with Sacred Geometry design language.
 * Dark-first, gold accents, organic shapes, phi-scaled spacing.
 * (c) 2026 HeadySystems Inc. All Rights Reserved.
 */
package com.headysystems.headybuddy.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.core.view.WindowCompat

private val HeadyDarkColorScheme = darkColorScheme(
    primary = HeadyGold,
    onPrimary = HeadySurfaceDark,
    primaryContainer = HeadyGoldDark,
    onPrimaryContainer = HeadyGoldLight,
    secondary = HeadyViolet,
    onSecondary = HeadyTextPrimary,
    secondaryContainer = HeadyVioletDark,
    onSecondaryContainer = HeadyVioletLight,
    tertiary = HeadyTeal,
    onTertiary = HeadySurfaceDark,
    tertiaryContainer = HeadyTealDark,
    onTertiaryContainer = HeadyTealLight,
    background = HeadySurfaceDark,
    onBackground = HeadyTextPrimary,
    surface = HeadySurfaceDeep,
    onSurface = HeadyTextPrimary,
    surfaceVariant = HeadySurfaceCard,
    onSurfaceVariant = HeadyTextSecondary,
    outline = HeadyTextTertiary,
    error = HeadyError,
    onError = HeadyTextPrimary,
)

private val HeadyLightColorScheme = lightColorScheme(
    primary = HeadyGoldDark,
    onPrimary = HeadyTextPrimary,
    primaryContainer = HeadyGoldLight,
    onPrimaryContainer = HeadySurfaceDark,
    secondary = HeadyVioletDark,
    onSecondary = HeadyTextPrimary,
    secondaryContainer = HeadyVioletLight,
    onSecondaryContainer = HeadySurfaceDark,
    tertiary = HeadyTealDark,
    onTertiary = HeadyTextPrimary,
)

private val HeadyTypography = Typography(
    displayLarge = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Bold,
        fontSize = SacredGeometry.textHero,
        letterSpacing = SacredGeometry.textTiny * -0.02f
    ),
    displayMedium = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Bold,
        fontSize = SacredGeometry.textDisplay
    ),
    headlineLarge = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.SemiBold,
        fontSize = SacredGeometry.textHeading
    ),
    headlineMedium = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.SemiBold,
        fontSize = SacredGeometry.textLarge
    ),
    titleLarge = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Medium,
        fontSize = SacredGeometry.textLarge
    ),
    titleMedium = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Medium,
        fontSize = SacredGeometry.textMedium
    ),
    bodyLarge = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Normal,
        fontSize = SacredGeometry.textBody,
        lineHeight = SacredGeometry.textLarge
    ),
    bodyMedium = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Normal,
        fontSize = SacredGeometry.textSmall
    ),
    labelLarge = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Medium,
        fontSize = SacredGeometry.textBody
    ),
    labelSmall = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Normal,
        fontSize = SacredGeometry.textTiny
    ),
)

@Composable
fun HeadyBuddyTheme(
    darkTheme: Boolean = true,
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) HeadyDarkColorScheme else HeadyLightColorScheme

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = HeadySurfaceDark.toArgb()
            window.navigationBarColor = HeadySurfaceDark.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !darkTheme
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = HeadyTypography,
        content = content
    )
}
