/**
 * HeadyBuddy Sacred Geometry Shapes.
 * Organic, rounded forms using Fibonacci-scaled corner radii.
 * (c) 2026 HeadySystems Inc. All Rights Reserved.
 */
package com.headysystems.headybuddy.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Shapes

val HeadyShapes = Shapes(
    extraSmall = RoundedCornerShape(SacredGeometry.cornerSmall),
    small = RoundedCornerShape(SacredGeometry.cornerMedium),
    medium = RoundedCornerShape(SacredGeometry.cornerLarge),
    large = RoundedCornerShape(SacredGeometry.cornerXLarge),
    extraLarge = RoundedCornerShape(SacredGeometry.cornerFull),
)
