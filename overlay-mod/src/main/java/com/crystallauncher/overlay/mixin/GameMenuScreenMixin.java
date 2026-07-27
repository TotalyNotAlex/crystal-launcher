package com.crystallauncher.overlay.mixin;

import com.crystallauncher.overlay.gui.OverlaySettingsScreen;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.screen.GameMenuScreen;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.text.Text;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(Screen.class)
public class GameMenuScreenMixin {
    @Inject(method = "init", at = @At("TAIL"))
    private void addOverlaySettingsButton(CallbackInfo ci) {
        Screen self = (Screen)(Object)this;
        if (!(self instanceof GameMenuScreen)) return;
        ButtonWidget btn = ButtonWidget.builder(
            Text.literal("Overlay Settings"),
            b -> MinecraftClient.getInstance().setScreen(new OverlaySettingsScreen(self))
        ).position(self.width / 2 - 100, self.height / 4 + 144).size(200, 20).build();
        ((ScreenAccessor)self).invokeAddDrawableChild(btn);
    }
}