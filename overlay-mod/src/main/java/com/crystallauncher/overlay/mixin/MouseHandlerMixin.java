package com.crystallauncher.overlay.mixin;

import com.crystallauncher.overlay.hud.CPSHandler;
import net.minecraft.client.Minecraft;
import net.minecraft.client.MouseHandler;
import net.minecraft.client.input.MouseButtonInfo;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(MouseHandler.class)
public class MouseHandlerMixin {
    @Inject(method = "onButton", at = @At("TAIL"))
    private void onButton(long window, MouseButtonInfo info, int mods, CallbackInfo ci) {
        if (info != null) {
            MouseHandler mh = Minecraft.getInstance().mouseHandler;
            if (mh != null) {
                if (info.button() == 0 && mh.isLeftPressed()) {
                    CPSHandler.onLeftClick();
                } else if (info.button() == 1 && mh.isRightPressed()) {
                    CPSHandler.onRightClick();
                }
            }
        }
    }
}
