package com.crystallauncher.overlay.mixin;

import com.crystallauncher.overlay.CrystalOverlayMod;
import com.crystallauncher.overlay.hud.HUDRenderer;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.hud.InGameHud;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Unique;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(InGameHud.class)
public class InGameHudMixin {
    @Unique private HUDRenderer overlayHudRenderer;

    @Inject(method = "render", at = @At("TAIL"))
    private void onRender(DrawContext context, float tickDelta, CallbackInfo ci) {
        MinecraftClient client = MinecraftClient.getInstance();
        if (overlayHudRenderer == null) overlayHudRenderer = new HUDRenderer(client);
        try {
            overlayHudRenderer.render(context, tickDelta);
        } catch (Exception e) {
            CrystalOverlayMod.LOGGER.error("Overlay render error", e);
        }
    }
}