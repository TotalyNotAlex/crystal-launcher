package com.crystallauncher.overlay.mixin;

import com.crystallauncher.overlay.hud.CPSHandler;
import net.minecraft.client.MouseHandler;
import net.minecraft.client.input.MouseButtonInfo;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(MouseHandler.class)
public class MouseHandlerMixin {
    @Inject(method = "onButton", at = @At("HEAD"))
    private void onButton(long window, MouseButtonInfo info, int mods, CallbackInfo ci) {
        if (info != null && info.input() == 1) { // 1 = GLFW_PRESS
            if (info.button() == 0) {
                CPSHandler.onLeftClick();
            } else if (info.button() == 1) {
                CPSHandler.onRightClick();
            }
        }
    }
}
