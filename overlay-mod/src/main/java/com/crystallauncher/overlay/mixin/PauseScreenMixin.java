package com.crystallauncher.overlay.mixin;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.PauseScreen;
import net.minecraft.network.chat.Component;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import com.crystallauncher.overlay.gui.OverlaySettingsScreen;

@Mixin(PauseScreen.class)
public class PauseScreenMixin {
    @Inject(method = "createPauseMenu", at = @At("TAIL"))
    private void onCreatePauseMenu(CallbackInfo ci) {
        PauseScreen self = (PauseScreen) (Object) this;
        int btnX = self.width / 2 - 100;
        int btnY = self.height / 4 + 128 + 24;

        Button overlayBtn = Button.builder(
            Component.literal("Overlay Settings"),
            btn -> Minecraft.getInstance().setScreen(new OverlaySettingsScreen(self))
        ).bounds(btnX, btnY, 200, 20).build();

        // Using ScreenAccessor to safely call the protected addRenderableWidget method
        ((ScreenAccessor) self).invokeAddRenderableWidget(overlayBtn);
    }
}
