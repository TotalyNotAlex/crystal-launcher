package com.crystallauncher.overlay.mixin;

import com.crystallauncher.overlay.hud.elements.CPSElement;
import net.minecraft.client.MinecraftClient;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(MinecraftClient.class)
public class MouseMixin {
    @Inject(method = "doAttack", at = @At("HEAD"))
    private void onLeftClick(CallbackInfoReturnable<Boolean> ci) {
        CPSElement.registerClick(0);
    }

    @Inject(method = "doItemUse", at = @At("HEAD"))
    private void onRightClick(CallbackInfoReturnable<Boolean> ci) {
        CPSElement.registerClick(1);
    }
}