package com.crystallauncher.overlay.mixin;

import com.crystallauncher.overlay.CrystalOverlayMod;
import com.crystallauncher.overlay.hud.elements.CPSElement;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.network.ClientPlayerEntity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Unique;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(MinecraftClient.class)
public class MouseMixin {
    @Unique private static final CPSElement cpsTracker = new CPSElement();

    @Inject(method = "doAttack", at = @At("HEAD"))
    private void onAttack(CallbackInfo ci) {
        cpsTracker.onAttack();
    }

    public static CPSElement getCpsTracker() {
        return cpsTracker;
    }
}