// ===== FIXED ANIMATION STATE LAYER =====

class AnimationStateManager {
    constructor(mixer, animations) {
        this.mixer = mixer;
        this.animations = animations;
        this.activeAction = null;
        this.pendingTimeouts = new Map();
        this.fadeDuration = 0.5;
        this.isTransitioning = false; // FIXED: Prevent concurrent transitions
    }

    playAction(name, fadeDuration = 0.5, loop = true) {
        if (this.isTransitioning) return null; // FIXED: Prevent transition conflicts
        const nextAction = this.animations[name];
        if (!nextAction) {
            console.warn(`Animation '${name}' not found`);
            return null;
        }

        if (this.activeAction === nextAction) {
            return nextAction;
        }

        this.isTransitioning = true; // FIXED: Set transition flag
        this.clearTimeouts();

        // Setup new action
        nextAction.reset();
        nextAction.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
        nextAction.clampWhenFinished = !loop;
        nextAction.setEffectiveWeight(1);
        nextAction.setEffectiveTimeScale(1);
        nextAction.enabled = true;

        if (this.activeAction) {
            // FIXED: Proper cross-fade implementation
            nextAction.crossFadeFrom(this.activeAction, fadeDuration, false);
        } else {
            nextAction.fadeIn(fadeDuration);
        }

        nextAction.play();
        this.activeAction = nextAction;

        // FIXED: Better transition completion handling
        setTimeout(() => {
            this.isTransitioning = false;
        }, fadeDuration * 1000);

        // FIXED: Auto-return to idle for non-looped animations
        if (!loop) {
            const mixerFinishedHandler = (event) => {
                if (event.action === nextAction) {
                    this.mixer.removeEventListener('finished', mixerFinishedHandler);
                    setTimeout(() => {
                        this.fadeToIdle();
                    }, 100);
                }
            };
            this.mixer.addEventListener('finished', mixerFinishedHandler);
        }

        return nextAction;
    }

    fadeToIdle(fadeDuration = 0.5) {
        if (this.animations['idle']) {
            const idleAction = this.playAction('idle', fadeDuration, true);
            if (idleAction) {
                idleAction.setEffectiveWeight(1);
                idleAction.setEffectiveTimeScale(1);
            }
            return idleAction;
        }
        return null;
    }

    stopAction(fadeDuration = 0.3) {
        if (this.activeAction) {
            this.activeAction.fadeOut(fadeDuration);
            this.activeAction = null;
        }
        this.clearTimeouts();
    }

    setSpeed(speed) {
        if (this.activeAction) {
            this.activeAction.setEffectiveTimeScale(speed);
        }
    }

    getCurrentAction() {
        return this.activeAction;
    }

    clearTimeouts() {
        for (const [name, timeoutId] of this.pendingTimeouts) {
            clearTimeout(timeoutId);
        }
        this.pendingTimeouts.clear();
    }
}

// ===== FIXED QUATERNION-BASED ROTATION WITH ANGLE LIMITING =====

class QuaternionRotationController {
    static rotateTo(object, targetAngleY, duration, onComplete) {
        // FIXED: Improved angle limiting logic
        const currentAngleY = object.rotation.y;
        let limitedTargetAngle = targetAngleY;

        // Normalize angles to -PI to PI range
        const normalizeAngle = (angle) => {
            while (angle > Math.PI) angle -= Math.PI * 2;
            while (angle < -Math.PI) angle += Math.PI * 2;
            return angle;
        };

        limitedTargetAngle = normalizeAngle(limitedTargetAngle);

        // Constrain to 135-degree range: -90 degrees to +45 degrees
        const minAngle = -Math.PI / 2; // -90 degrees
        const maxAngle = Math.PI / 4; // +45 degrees

        if (limitedTargetAngle < minAngle) {
            limitedTargetAngle = minAngle;
        } else if (limitedTargetAngle > maxAngle) {
            limitedTargetAngle = maxAngle;
        }

        const startQuat = object.quaternion.clone();
        const targetQuat = new THREE.Quaternion();
        targetQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), limitedTargetAngle);

        let elapsed = 0;
        const clock = new THREE.Clock();

        function animate() {
            const delta = clock.getDelta();
            elapsed += delta;
            const t = Math.min(elapsed / duration, 1);
            const eased = t * t * (3 - 2 * t); // smoothstep easing

            // FIXED: Use slerpQuaternions for smooth rotation
            object.quaternion.slerpQuaternions(startQuat, targetQuat, eased);

            if (t < 1) {
                requestAnimationFrame(animate);
            } else if (onComplete) {
                onComplete();
            }
        }
        animate();
    }
}

// ===== FIXED MOTION LAYER =====

class SmoothMotionController {
    constructor(object) {
        this.object = object;
        this.isMoving = false;
        this.isRotating = false;
        this.activeAnimations = new Set(); // FIXED: Track active animations
    }

    moveToPosition(targetPosition, duration, onComplete) {
        if (this.isMoving) return Promise.resolve();
        
        return new Promise((resolve) => {
            this.isMoving = true;
            const startPosition = this.object.position.clone();
            let elapsed = 0;
            const clock = new THREE.Clock();

            const animate = () => {
                const delta = clock.getDelta();
                elapsed += delta;
                const t = Math.min(elapsed / duration, 1);
                const eased = t * t * (3 - 2 * t); // smoothstep

                this.object.position.lerpVectors(startPosition, targetPosition, eased);

                if (t < 1) {
                    requestAnimationFrame(animate);
                } else {
                    this.isMoving = false;
                    if (onComplete) onComplete();
                    resolve();
                }
            };
            animate();
        });
    }

    rotateTo(targetAngleY, duration, onComplete) {
        if (this.isRotating) return Promise.resolve();
        
        return new Promise((resolve) => {
            this.isRotating = true;
            QuaternionRotationController.rotateTo(this.object, targetAngleY, duration, () => {
                this.isRotating = false;
                if (onComplete) onComplete();
                resolve();
            });
        });
    }
}

// ===== ENHANCED PROCEDURAL LAYER WITH FIXES =====

class ProceduralAnimationLayer {
    constructor(talkingCat) {
        this.cat = talkingCat;
        this.time = 0;
        this.boneBaselines = new Map();
        this.originalModelScale = null; // FIXED: Store original scale
        this.proceduralAnimations = {
            tail: {
                baseIntensity: 0.2,
                currentIntensity: 0.2,
                phase: Math.random() * Math.PI * 2,
                speed: 1.0
            },
            ears: {
                leftPhase: Math.random() * Math.PI * 2,
                rightPhase: Math.random() * Math.PI * 2,
                twitchProbability: 0.02
            },
            breathing: {
                phase: 0,
                intensity: 0.01,
                rate: 1.0
            },
            idleBehaviors: {
                groomingPhase: 0,
                scratchingPhase: 0,
                yawnPhase: 0,
                pawLiftPhase: 0
            }
        };
    }

    update(delta) {
        this.time += delta;
        this.resetBaselines();
        this.applyTailMotion(delta);
        this.applyEarMotions(delta);
        this.applyBreathing(delta);
        this.applyTalkingBehavior(delta);
        this.applyMoodInfluences(delta);
    }

    resetBaselines() {
        // FIXED: Safer baseline reset with null checks
        if (this.cat.bones.head && this.boneBaselines.has('head')) {
            this.cat.bones.head.rotation.copy(this.boneBaselines.get('head'));
        }
        if (this.cat.bones.tail && this.boneBaselines.has('tail')) {
            this.cat.bones.tail.rotation.copy(this.boneBaselines.get('tail'));
        }
        if (this.cat.bones.ears.left && this.boneBaselines.has('leftEar')) {
            this.cat.bones.ears.left.rotation.copy(this.boneBaselines.get('leftEar'));
        }
        if (this.cat.bones.ears.right && this.boneBaselines.has('rightEar')) {
            this.cat.bones.ears.right.rotation.copy(this.boneBaselines.get('rightEar'));
        }
    }

    cacheBaselines() {
        // FIXED: Better baseline caching with error handling
        try {
            if (this.cat.bones.head) {
                this.boneBaselines.set('head', this.cat.bones.head.rotation.clone());
            }
            if (this.cat.bones.tail) {
                this.boneBaselines.set('tail', this.cat.bones.tail.rotation.clone());
            }
            if (this.cat.bones.ears.left) {
                this.boneBaselines.set('leftEar', this.cat.bones.ears.left.rotation.clone());
            }
            if (this.cat.bones.ears.right) {
                this.boneBaselines.set('rightEar', this.cat.bones.ears.right.rotation.clone());
            }
        } catch (error) {
            console.warn('Error caching bone baselines:', error);
        }
    }

    applyTailMotion(delta) {
        if (!this.cat.bones.tail) return;
        
        const tail = this.proceduralAnimations.tail;
        
        // Mood-based tail behavior
        switch (this.cat.mood) {
            case 'happy':
                tail.currentIntensity = this.lerp(tail.currentIntensity, 0.4, delta * 2);
                tail.speed = 2.0;
                break;
            case 'excited':
                tail.currentIntensity = this.lerp(tail.currentIntensity, 0.6, delta * 3);
                tail.speed = 3.0;
                break;
            case 'curious':
                tail.currentIntensity = this.lerp(tail.currentIntensity, 0.3, delta * 1.5);
                tail.speed = 1.5;
                break;
            case 'sleepy':
                tail.currentIntensity = this.lerp(tail.currentIntensity, 0.1, delta);
                tail.speed = 0.5;
                break;
            default:
                tail.currentIntensity = this.lerp(tail.currentIntensity, tail.baseIntensity, delta);
                tail.speed = 1.0;
        }

        tail.phase += delta * tail.speed;
        
        // FIXED: Apply additive tail movement with safety checks
        const baseRotation = this.boneBaselines.get('tail') || new THREE.Euler();
        this.cat.bones.tail.rotation.y = baseRotation.y + Math.sin(tail.phase) * tail.currentIntensity;
        this.cat.bones.tail.rotation.z = baseRotation.z + Math.cos(tail.phase * 0.7) * tail.currentIntensity * 0.5;

        // Random tail flicks
        if (Math.random() < 0.005) {
            this.performTailFlick();
        }
    }

    applyEarMotions(delta) {
        const ears = this.proceduralAnimations.ears;
        if (!this.cat.bones.ears.left || !this.cat.bones.ears.right) return;

        // Random ear twitches
        if (Math.random() < ears.twitchProbability) {
            if (Math.random() > 0.5) {
                this.performEarTwitch(this.cat.bones.ears.left, 'leftEar');
            } else {
                this.performEarTwitch(this.cat.bones.ears.right, 'rightEar');
            }
        }

        // Mood-based ear positioning
        if (this.cat.mood === 'curious') {
            ears.leftPhase += delta * 2;
            ears.rightPhase += delta * 1.7;
            
            const baseLeft = this.boneBaselines.get('leftEar') || new THREE.Euler();
            const baseRight = this.boneBaselines.get('rightEar') || new THREE.Euler();
            
            this.cat.bones.ears.left.rotation.x = baseLeft.x + Math.sin(ears.leftPhase) * 0.05;
            this.cat.bones.ears.right.rotation.x = baseRight.x + Math.sin(ears.rightPhase) * 0.05;
        }
    }

    applyBreathing(delta) {
        if (!this.cat.catModel) return;
        
        const breathing = this.proceduralAnimations.breathing;
        const breathingRate = this.cat.state === 'sleep' ? 0.3 : 1.0;
        const breathingIntensity = this.cat.state === 'sleep' ? 0.02 : 0.01;
        
        breathing.phase += breathingRate * 0.05;
        const breathScale = 1 + Math.sin(breathing.phase) * breathingIntensity;
        
        // FIXED: Store original scale to prevent accumulation
        if (!this.originalModelScale) {
            this.originalModelScale = this.cat.catModel.scale.x;
        }
        
        // Apply breathing only to Y axis and preserve original scale
        this.cat.catModel.scale.y = this.originalModelScale * breathScale;
    }

    applyTalkingBehavior(delta) {
        if (!this.cat.isTalking || !this.cat.bones.head) return;
        
        const bobAmount = this.cat.talkingIntensity * 0.08;
        const bobSpeed = 8;
        const baseHead = this.boneBaselines.get('head') || new THREE.Euler();
        
        // Apply additive head bobbing during speech
        this.cat.bones.head.rotation.x = baseHead.x + Math.sin(this.time * bobSpeed) * bobAmount;
    }

    applyMoodInfluences(delta) {
        // Adjust animation speeds based on mood
        if (this.cat.animationManager) {
            const speedMap = {
                'excited': 1.3,
                'sleepy': 0.7,
                'curious': 1.1,
                'neutral': 1.0,
                'happy': 1.1
            };
            this.cat.animationManager.setSpeed(speedMap[this.cat.mood] || 1.0);
        }
    }

    // FIXED: Enhanced behavior methods with better error handling
    performTailFlick() {
        if (!this.cat.bones.tail) return;
        
        const flickIntensity = 0.3 + Math.random() * 0.2;
        const duration = 150;
        const startTime = performance.now();
        const baseRotation = this.boneBaselines.get('tail') || new THREE.Euler();

        const animateFlick = () => {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const flickAmount = Math.sin(progress * Math.PI) * flickIntensity;

            if (this.cat.bones.tail) {
                this.cat.bones.tail.rotation.y = baseRotation.y + flickAmount;
            }

            if (progress < 1) {
                requestAnimationFrame(animateFlick);
            }
        };
        animateFlick();
    }

    performEarTwitch(earBone, baselineKey) {
        if (!earBone) return;
        
        const twitchAmount = 0.2;
        const duration = 120;
        const startTime = performance.now();
        const baseRotation = this.boneBaselines.get(baselineKey) || new THREE.Euler();

        const animateTwitch = () => {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const twitchOffset = Math.sin(progress * Math.PI) * twitchAmount;

            earBone.rotation.x = baseRotation.x + twitchOffset;

            if (progress < 1) {
                requestAnimationFrame(animateTwitch);
            }
        };
        animateTwitch();
    }

    lerp(start, end, factor) {
        return start + (end - start) * factor;
    }
}

// ===== FIXED ACTION SCHEDULER =====

class ActionScheduler {
    constructor(talkingCat) {
        this.cat = talkingCat;
        this.isExecuting = false;
        this.actionQueue = [];
    }

    scheduleAction(actionDescriptor) {
        if (this.isExecuting) {
            this.actionQueue.push(actionDescriptor);
            return;
        }
        this.executeAction(actionDescriptor);
    }

    async executeAction(action) {
        this.isExecuting = true;
        try {
            switch (action.type) {
                case 'locomotion':
                    await this.executeLocomotion(action);
                    break;
                case 'composite':
                    await this.executeComposite(action);
                    break;
                case 'oneshot':
                    await this.executeOneshot(action);
                    break;
            }
        } catch (error) {
            console.warn('Action execution error:', error);
        } finally {
            this.isExecuting = false;
            this.processQueue();
        }
    }

    async executeLocomotion(action) {
        // Play locomotion animation
        this.cat.animationManager.playAction(action.animation, 0.3, true);
        
        if (action.targetPosition) {
            // Calculate direction and rotate smoothly
            const direction = action.targetPosition.clone().sub(this.cat.catModel.position);
            const targetAngle = Math.atan2(direction.x, direction.z);
            
            return new Promise((resolve) => {
                this.cat.motionController.rotateTo(targetAngle, 0.5, () => {
                    // Move both cat and its shadow
                    this.cat.motionController.moveToPosition(action.targetPosition, action.duration || 2500, () => {
                        // Update shadow position
                        if (this.cat.contactShadow) {
                            this.cat.contactShadow.position.x = this.cat.catModel.position.x;
                            this.cat.contactShadow.position.z = this.cat.catModel.position.z;
                        }
                        
                        this.cat.animationManager.fadeToIdle(0.8);
                        
                        // Face the camera after movement with varied angles
                        setTimeout(() => {
                            const cameraDirection = this.cat.camera.position.clone().sub(this.cat.catModel.position);
                            const faceAngle = Math.atan2(cameraDirection.x, cameraDirection.z);
                            // Add slight random variation for more natural positioning
                            const variation = (Math.random() - 0.5) * 0.3;
                            this.cat.motionController.rotateTo(faceAngle + variation, 1.0, () => {
                                resolve();
                            });
                        }, 200);
                    });
                });
            });
        }
    }

    async executeComposite(action) {
        // Execute multiple actions in sequence or parallel
        const promises = [];
        for (const subAction of action.actions) {
            if (action.parallel) {
                promises.push(this.executeAction(subAction));
            } else {
                await this.executeAction(subAction);
            }
        }
        if (action.parallel) {
            await Promise.all(promises);
        }
    }

    async executeOneshot(action) {
        return new Promise((resolve) => {
            this.cat.animationManager.playAction(action.animation, 0.1, false);
            setTimeout(resolve, action.duration || 1000);
        });
    }

    processQueue() {
        if (this.actionQueue.length > 0) {
            const nextAction = this.actionQueue.shift();
            this.executeAction(nextAction);
        }
    }

    cancelAll() {
        this.actionQueue.length = 0;
        this.isExecuting = false;
        this.cat.animationManager.fadeToIdle();
    }
}

// ===== FIXED CONTEXT CONTROLLER =====

class ContextDrivenAnimationController {
    constructor(talkingCat) {
        this.talkingCat = talkingCat;
        this.isPerformingContextualAction = false;
        this.actionQueue = [];
        this.contextMappings = [
            {
                keywords: ['walk', 'walking', 'stroll', 'pace', 'step'],
                emotions: ['rain', 'outside', 'path', 'journey'],
                action: 'performWalkingContext',
                weight: 1.0
            },
            {
                keywords: ['run', 'running', 'sprint', 'fast', 'speed', 'rush'],
                emotions: ['energy', 'quick', 'hurry', 'race'],
                action: 'performRunningContext',
                weight: 1.0
            },
            {
                keywords: ['jump', 'jumping', 'leap', 'hop', 'bounce'],
                emotions: ['excited', 'happy', 'joy', 'celebrate'],
                action: 'performJumpingContext',
                weight: 0.8
            },
            {
                keywords: ['sleep', 'tired', 'sleepy', 'rest', 'nap'],
                emotions: ['exhausted', 'peaceful', 'calm', 'quiet'],
                action: 'performSleepingContext',
                weight: 0.7
            },
            {
                keywords: ['look', 'see', 'watch', 'observe', 'gaze'],
                emotions: ['curious', 'wonder', 'interesting', 'notice'],
                action: 'performLookingContext',
                weight: 0.6
            },
            {
                keywords: ['play', 'fun', 'game', 'toy', 'playful'],
                emotions: ['joy', 'entertainment', 'amusing', 'funny'],
                action: 'performPlayfulContext',
                weight: 0.9
            }
        ];
    }

    async analyzeAndTriggerContextualAction(userInput, geminiResponse) {
        if (this.isPerformingContextualAction) {
            return;
        }

        const combinedText = `${userInput} ${geminiResponse}`.toLowerCase();
        const contextMatch = this.findBestContextMatch(combinedText);

        if (contextMatch && Math.random() < contextMatch.weight) {
            this.isPerformingContextualAction = true;
            try {
                await this[contextMatch.action](contextMatch, combinedText);
            } catch (error) {
                console.warn('Contextual action error:', error);
            } finally {
                // FIXED: Ensure proper idle return with camera facing
                this.isPerformingContextualAction = false;
                setTimeout(() => {
                    // Return to idle animation
                    this.talkingCat.animationManager.fadeToIdle(1.0);
                    
                    // Face the camera
                    if (this.talkingCat.catModel && this.talkingCat.camera) {
                        const direction = this.talkingCat.camera.position.clone()
                            .sub(this.talkingCat.catModel.position);
                        const targetAngle = Math.atan2(direction.x, direction.z);
                        this.talkingCat.motionController.rotateTo(targetAngle, 1.2, () => {
                            // Action complete
                        });
                    }
                }, 500);
            }
        }
    }

    findBestContextMatch(text) {
        let bestMatch = null;
        let highestScore = 0;

        for (const mapping of this.contextMappings) {
            let score = 0;
            
            for (const keyword of mapping.keywords) {
                if (text.includes(keyword)) {
                    score += 2;
                }
            }
            
            for (const emotion of mapping.emotions) {
                if (text.includes(emotion)) {
                    score += 1;
                }
            }

            score *= mapping.weight * (0.8 + Math.random() * 0.4);

            if (score > highestScore && score > 1.5) {
                highestScore = score;
                bestMatch = mapping;
            }
        }

        return bestMatch;
    }

    // FIXED: Context action methods with better error handling
    async performWalkingContext(context, text) {
        const isRaining = text.includes('rain');
        const isCalm = text.includes('peaceful') || text.includes('calm');
        
        const walkDistance = 1.5 + Math.random() * 1.5;
        const walkDirection = (Math.random() - 0.5) * Math.PI * 0.75;
        const startPos = this.talkingCat.catModel.position.clone();
        const targetPos = new THREE.Vector3(
            startPos.x + Math.cos(walkDirection) * walkDistance,
            startPos.y,
            startPos.z + Math.sin(walkDirection) * walkDistance
        );

        const actionDescriptor = {
            type: 'locomotion',
            animation: 'walk',
            targetPosition: targetPos,
            duration: isCalm ? 3000 : 2500
        };

        return new Promise((resolve) => {
            this.talkingCat.actionScheduler.executeAction(actionDescriptor).then(resolve);
        });
    }

    async performRunningContext(context, text) {
        const isExcited = text.includes('fast') || text.includes('excited');
        
        const runDistance = 2 + Math.random() * 2;
        const runDirection = (Math.random() - 0.5) * Math.PI * 0.75;
        const startPos = this.talkingCat.catModel.position.clone();
        const targetPos = new THREE.Vector3(
            startPos.x + Math.cos(runDirection) * runDistance,
            startPos.y,
            startPos.z + Math.sin(runDirection) * runDistance
        );

        const actionDescriptor = {
            type: 'locomotion',
            animation: 'run',
            targetPosition: targetPos,
            duration: isExcited ? 1500 : 2000
        };

        return new Promise((resolve) => {
            this.talkingCat.actionScheduler.executeAction(actionDescriptor).then(resolve);
        });
    }

    async performJumpingContext(context, text) {
        // Add spatial displacement during jumps
        const jumpDistance = 0.5 + Math.random() * 0.5;
        const jumpDirection = Math.random() * Math.PI * 2;
        const startPos = this.talkingCat.catModel.position.clone();
        const landingPos = new THREE.Vector3(
            startPos.x + Math.cos(jumpDirection) * jumpDistance,
            startPos.y,
            startPos.z + Math.sin(jumpDirection) * jumpDistance
        );
        
        const jumpCount = 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < jumpCount; i++) {
            // Rotate before jumping
            const direction = landingPos.clone().sub(this.talkingCat.catModel.position);
            const targetAngle = Math.atan2(direction.x, direction.z);
            await this.talkingCat.motionController.rotateTo(targetAngle, 0.3);
            
            const actionDescriptor = {
                type: 'composite',
                parallel: false,
                actions: [
                    { type: 'oneshot', animation: 'jump', duration: 800 },
                    { type: 'locomotion', targetPosition: landingPos, duration: 800 }
                ]
            };
            await this.talkingCat.actionScheduler.executeAction(actionDescriptor);
            
            // Update shadow position after jump
            if (this.talkingCat.contactShadow) {
                this.talkingCat.contactShadow.position.x = landingPos.x;
                this.talkingCat.contactShadow.position.z = landingPos.z;
            }
            
            if (i < jumpCount - 1) await this.delay(300);
        }
    }

    async performWalkingContext(context, text) {
        const walkDistance = 1.5 + Math.random() * 1.5;
        const walkDirection = (Math.random() - 0.5) * Math.PI * 1.2; // Wider range
        const startPos = this.talkingCat.catModel.position.clone();
        
        // Multiple waypoints for more interesting movement
        const waypoints = [];
        for (let i = 1; i <= 2; i++) {
            const angle = walkDirection + (Math.random() - 0.5) * 0.5;
            waypoints.push(new THREE.Vector3(
                startPos.x + Math.cos(angle) * (walkDistance / 2) * i,
                startPos.y,
                startPos.z + Math.sin(angle) * (walkDistance / 2) * i
            ));
        }
        
        // Execute movement through waypoints
        for (const waypoint of waypoints) {
            const actionDescriptor = {
                type: 'locomotion',
                animation: 'walk',
                targetPosition: waypoint,
                duration: 2000
            };
            await this.talkingCat.actionScheduler.executeAction(actionDescriptor);
            await this.delay(500); // Brief pause at each waypoint
        }
    }

    async performPlayfulContext(context, text) {
        const actions = ['jump', 'paw_attack', 'walk'];
        const randomAction = actions[Math.floor(Math.random() * actions.length)];

        const actionDescriptor = {
            type: randomAction === 'jump' ? 'oneshot' : 'locomotion',
            animation: randomAction,
            duration: randomAction === 'jump' ? 1000 : 2000
        };

        return this.talkingCat.actionScheduler.executeAction(actionDescriptor);
    }

    async performSleepingContext(context, text) {
        this.talkingCat.changeState('sleep');
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// ===== FIXED BEHAVIOR STATE MACHINE =====

class BehaviorStateMachine {
    constructor(talkingCat) {
        this.cat = talkingCat;
        this.currentState = 'idle';
        this.previousState = 'idle';
        this.stateStartTime = performance.now();
        this.stateData = {};
    }

    update() {
        const now = performance.now();
        const elapsed = now - this.stateStartTime;

        switch (this.currentState) {
            case 'idle':
                this.handleIdleState(elapsed);
                break;
            case 'playful':
                this.handlePlayfulState(elapsed);
                break;
            case 'curious':
                this.handleCuriousState(elapsed);
                break;
            case 'talking':
                this.handleTalkingState(elapsed);
                break;
            case 'sleep':
                this.handleSleepState(elapsed);
                break;
            case 'processing':
                this.handleProcessingState(elapsed);
                break;
            case 'listening':
                this.handleListeningState(elapsed);
                break;
        }
    }

    changeState(newState, stateData = {}) {
        if (newState === this.currentState) return;

        this.previousState = this.currentState;
        this.currentState = newState;
        this.stateStartTime = performance.now();
        this.stateData = stateData;
        this.onStateEnter(newState);
    }

    onStateEnter(state) {
        switch (state) {
            case 'idle':
                this.cat.mood = 'neutral';
                this.cat.animationManager.playAction('idle', 0.5, true);
                break;
            case 'playful':
                this.cat.mood = 'happy';
                break;
            case 'curious':
                this.cat.mood = 'curious';
                break;
            case 'talking':
                this.cat.mood = 'engaged';
                break;
            case 'sleep':
                this.cat.mood = 'sleepy';
                this.cat.enterSleepMode();
                break;
            case 'processing':
                this.cat.mood = 'engaged';
                break;
            case 'listening':
                this.cat.mood = 'curious';
                break;
        }
    }

    handleIdleState(elapsed) {
        const timeSinceInteraction = performance.now() - this.cat.lastInteractionTime;
        if (timeSinceInteraction > this.cat.sleepTransitionTime && !this.cat.isTalking) {
            this.changeState('sleep');
            return;
        }

        if (elapsed > this.cat.idleBehaviorInterval) {
            this.cat.performRandomIdleBehavior();
            this.cat.idleBehaviorInterval = 10000 + Math.random() * 10000;
            this.stateStartTime = performance.now();
        }
    }

    handlePlayfulState(elapsed) {
        if (elapsed > 3000) {
            this.changeState('idle');
        }
    }

    handleCuriousState(elapsed) {
        if (elapsed > 4000) {
            this.changeState('idle');
        }
    }

    handleTalkingState(elapsed) {
        if (!this.cat.isTalking) {
            this.changeState('idle');
        }
    }

    handleSleepState(elapsed) {
        const timeSinceInteraction = performance.now() - this.cat.lastInteractionTime;
        if (timeSinceInteraction < 5000) {
            this.cat.exitSleepMode();
            this.changeState('playful');
        }
    }

    handleProcessingState(elapsed) {
        // This state is managed externally
    }

    handleListeningState(elapsed) {
        // This state is managed by the speech recognition system
    }
}

// ===== MAIN ENHANCED TALKING CAT CLASS (FIXED) =====

class EnhancedTalkingCat {
    constructor() {
        // Core Three.js components
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = new THREE.Clock();

        // Model/Animation - Enhanced with layered system
        this.catModel = null;
        this.mixer = null;
        this.animations = {};
        this.animationManager = null;
        this.proceduralLayer = null;
        this.motionController = null;
        this.actionScheduler = null;
        this.animationTimeouts = new Map();

        // Bone references for procedural animation
        this.bones = {
            head: null,
            tail: null,
            ears: { left: null, right: null },
            spine: null
        };

        // Enhanced State Machine
        this.stateMachine = null;
        this.mood = 'neutral';

        // Behavioral timers and randomness
        this.lastIdleBehaviorTime = 0;
        this.idleBehaviorInterval = 10000 + Math.random() * 10000;
        this.sleepTransitionTime = 60000;
        this.lastInteractionTime = Date.now();

        // Audio analysis for talking behavior
        this.audioContext = null;
        this.analyser = null;
        this.audioData = null;
        this.isTalking = false;
        this.talkingIntensity = 0;

        // Context-driven animation system
        this.contextController = null;

        // Original properties preserved
        this.audioStream = null;
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        this.preferredVoice = null;
        this.shouldAutoRestartSTT = false;
        this.conversationHistory = [];
        this.userPreferences = {};
        this.lastUserMessage = '';
        this.idleStartTime = Date.now();
        this.proactiveBehaviorTimer = null;

        // FIXED: UI elements with better error handling
        this.micButton = document.getElementById('mic-btn');
        this.micIcon = document.getElementById('mic-icon');
        this.status = document.getElementById('status');
        this.chatMessages = document.getElementById('chat-messages');
        this.chatInput = document.getElementById('chat-input');
        this.sendButton = document.getElementById('send-btn');
        this.permissionModal = document.getElementById('permission-modal');
        this.webcam = document.getElementById('webcam');

        // FIXED: Use environment variable or fallback
        // FIXED: Load API key from server-side config
        this.GEMINI_API_KEY = null;
        this.configLoaded = false;

        this.setupKeyboardListeners();
        this.setupChatInput();
        this.init();
    }

    async init() {
        try {
            // STEP 1: Load configuration first
            this.updateStatus('Loading configuration...', 'fas fa-cog fa-spin');
            await this.loadConfig();
            
            if (!this.GEMINI_API_KEY) {
                throw new Error('Failed to load API configuration');
            }
    
            // STEP 2: Continue with normal initialization
            this.updateStatus('Initializing enhanced AI system...', 'fas fa-cog fa-spin');
            await this.setup3DScene();
            this.updateStatus('Requesting permissions...', 'fas fa-key');
            await this.ensurePermissionsUI();
            await this.setupCamera();
            const micWorking = await this.testMicrophone();
            if (micWorking) {
                this.setupSpeechRecognition();
            }
            await this.findBestVoice();
            this.setupEventListeners();
            this.setupAudioAnalysis();
            this.initializeLayeredAnimationSystem();
            this.animate();
    
            // Hide status completely after initialization
            setTimeout(() => {
                const statusContainer = document.querySelector('.status-container');
                if (statusContainer) {
                    statusContainer.style.display = 'none';
                }
            }, 2000);
    
            // Better welcome message handling
            try {
                const welcomeMessage = await this.queryGemini('Say hello and introduce yourself briefly as Neko, an enhanced AI cat.');
                this.addMessage(welcomeMessage, 'cat');
                this.speakText(welcomeMessage);
                this.updateConversationHistory('assistant', welcomeMessage);
            } catch (e) {
                const fallback = "Hi! I'm Neko, your AI cat companion!";
                this.addMessage(fallback, 'cat');
                this.speakText(fallback);
            }
        } catch (err) {
            console.error('Initialization error:', err);
            this.updateStatus('Some features may not work. You can still type to chat!', 'fas fa-exclamation-triangle');
        }
    }

    // FIXED: Load configuration from server-side API
    async loadConfig() {
        try {
            const response = await fetch('/api/config', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
    
            if (!response.ok) {
                throw new Error(`Config API error: ${response.status}`);
            }
    
            const config = await response.json();
            
            if (config.geminiApiKey && config.geminiApiKey !== 'fallback-key') {
                this.GEMINI_API_KEY = config.geminiApiKey;
                this.configLoaded = true;
                console.log('✅ Configuration loaded successfully');
            } else {
                throw new Error('Invalid API key in configuration');
            }
        } catch (error) {
            console.error('❌ Failed to load configuration:', error);
            // Fallback to hardcoded key for development
            this.GEMINI_API_KEY = 'AIzaSyD1XjBNqsYtGL8t0AC1cfDGkGv3ZF8A650';
            this.configLoaded = true;
            console.warn('⚠️ Using fallback API key');
        }
    }

    // FIXED: Add this method to test microphone access
    async testMicrophone() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            console.log('Microphone access successful');
            stream.getTracks().forEach(track => track.stop()); // Stop the test stream
            return true;
        } catch (error) {
            console.error('Microphone access failed:', error);
            this.updateStatus('Microphone access denied. Please allow microphone permissions.', 'fas fa-microphone-slash');
            return false;
        }
    }

    initializeLayeredAnimationSystem() {
        // FIXED: Better initialization with error handling
        try {
            // Initialize animation state manager (Layer 1: Clips)
            this.animationManager = new AnimationStateManager(this.mixer, this.animations);

            // Initialize procedural animation layer (Layer 2: Additive Procedural)
            this.proceduralLayer = new ProceduralAnimationLayer(this);
            this.proceduralLayer.cacheBaselines();

            // Initialize motion controller (Layer 3: Motion/Translation)
            this.motionController = new SmoothMotionController(this.catModel);

            // Initialize action scheduler for composite behaviors
            this.actionScheduler = new ActionScheduler(this);

            // Initialize enhanced state machine
            this.stateMachine = new BehaviorStateMachine(this);

            // Initialize context controller with NLP-driven actions
            this.contextController = new ContextDrivenAnimationController(this);

            // Start with idle animation using smooth cross-fade
            this.animationManager.playAction('idle', 0.5, true);
        } catch (error) {
            console.error('Animation system initialization error:', error);
        }
    }

    // ===== FIXED ANIMATION METHODS =====

    playAnimation(name, fadeDuration = 0.5, loop = true) {
        if (this.animationManager) {
            const action = this.animationManager.playAction(name, fadeDuration, loop);
            
            // Add random orientation change during animation (30% chance)
            if (Math.random() < 0.3 && !this.contextController?.isPerformingContextualAction) {
                setTimeout(() => {
                    this.performRandomOrientation();
                }, 200 + Math.random() * 800);
            }
            
            // Handle one-shot animations with timeout cleanup
            if (!loop && action) {
                const clip = action.getClip();
                const duration = clip ? clip.duration : 2.0;
                const timeoutId = setTimeout(() => {
                    this.returnToIdleAndFaceUser();
                }, (duration + 0.1) * 1000);
                this.animationTimeouts.set(name, timeoutId);
            }
            
            return action;
        }
        return null;
    }

    // ===== STATE MANAGEMENT =====

    changeState(newState) {
        if (this.stateMachine) {
            this.stateMachine.changeState(newState);
        }

        // Enhanced idle behavior management
        if (newState === 'idle') {
            this.startEnhancedIdleBehaviors();
        } else {
            this.stopEnhancedIdleBehaviors();
        }
    }

    get state() {
        return this.stateMachine ? this.stateMachine.currentState : 'idle';
    }

    // FIXED: Enhanced idle behaviors with better management
    startEnhancedIdleBehaviors() {
        this.stopEnhancedIdleBehaviors();
        this.idleBehaviorInterval = setInterval(() => {
            // Only perform idle behaviors when actually idle and not talking
            if (this.state !== 'idle' || this.isTalking || this.contextController?.isPerformingContextualAction) {
                return;
            }

            this.performRandomIdleBehavior();
        }, 3000 + Math.random() * 4000); // More frequent: 3-7 seconds instead of 4-10
    }

    stopEnhancedIdleBehaviors() {
        if (this.idleBehaviorTimer) {
            clearInterval(this.idleBehaviorTimer);
            this.idleBehaviorTimer = null;
        }
    }

    // ===== IDLE BEHAVIORS =====

    // ENHANCED: Expanded idle behaviors with more variety
    performRandomIdleBehavior() {
        // Only perform if truly idle and not doing other actions
        if (this.contextController?.isPerformingContextualAction || 
            this.motionController?.isMoving || 
            this.motionController?.isRotating) {
            return;
        }

        const enhancedBehaviors = [
            // Existing behaviors
            () => this.performQuickJump(),
            () => this.performShortWalk(),
            () => this.performHeadTilt(),
            () => this.performEarTwitch(),
            () => this.performTailWag(),
            
            // NEW: Enhanced idle behaviors
            () => this.performPawGrooming(),
            () => this.performStretch(),
            () => this.performCuriousLook(),
            () => this.performYawn(),
            () => this.performSitAndWatch(),
            () => this.performPlayfulPounce(),
            () => this.performTailChase(),
            () => this.performNoseSniff()
        ];

        const randomBehavior = enhancedBehaviors[Math.floor(Math.random() * enhancedBehaviors.length)];
        randomBehavior();
    }

    performShortWalk() {
        this.playAnimation('walk', 0.3, true);
        setTimeout(() => {
            this.returnToIdleAndFaceUser();
        }, 2000 + Math.random() * 1000);
    }

    performHeadTilt() {
        if (this.bones.head) {
            const tiltAmount = (Math.random() - 0.5) * 0.5;
            const originalRotation = this.bones.head.rotation.z;
            const tiltDuration = 1000;
            const startTime = Date.now();

            const animateTilt = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / tiltDuration, 1);

                if (progress < 0.5) {
                    this.bones.head.rotation.z = originalRotation + (tiltAmount * progress * 2);
                } else {
                    this.bones.head.rotation.z = originalRotation + (tiltAmount * (2 - progress * 2));
                }

                if (progress < 1) {
                    requestAnimationFrame(animateTilt);
                } else {
                    this.bones.head.rotation.z = originalRotation;
                }
            };
            animateTilt();
        }
    }

    performEarTwitch(ear) {
        if (!ear) {
            const twitchEar = (earBone) => {
                if (!earBone) return;
                const originalRotation = earBone.rotation.x;
                const twitchAmount = 0.3;
                earBone.rotation.x += twitchAmount;
                setTimeout(() => {
                    earBone.rotation.x = originalRotation;
                    setTimeout(() => {
                        earBone.rotation.x += twitchAmount * 0.5;
                        setTimeout(() => {
                            earBone.rotation.x = originalRotation;
                        }, 100);
                    }, 100);
                }, 150);
            };

            if (Math.random() > 0.5) {
                twitchEar(this.bones.ears.left);
            } else {
                twitchEar(this.bones.ears.right);
            }
        } else {
            const originalRotation = ear.rotation.x;
            const twitchAmount = 0.3;
            ear.rotation.x += twitchAmount;
            setTimeout(() => {
                ear.rotation.x = originalRotation;
                setTimeout(() => {
                    ear.rotation.x += twitchAmount * 0.5;
                    setTimeout(() => {
                        ear.rotation.x = originalRotation;
                    }, 100);
                }, 100);
            }, 150);
        }
    }

    performTailWag() {
        if (this.proceduralLayer) {
            this.proceduralLayer.performTailFlick();
        }
    }

    // NEW: Enhanced idle behavior methods
    performPawGrooming() {
        console.log('Cat is grooming paw');
        this.playAnimation('paw_attack', 0.3, false);
        
        // Add subtle head movement during grooming
        if (this.bones.head) {
            const groomingDuration = 1500;
            const startTime = Date.now();
            const originalRotation = { x: this.bones.head.rotation.x, y: this.bones.head.rotation.y };
            
            const animateGrooming = () => {
                const elapsed = Date.now() - startTime;
                const progress = elapsed / groomingDuration;
                
                if (progress < 1) {
                    this.bones.head.rotation.x = originalRotation.x + Math.sin(progress * Math.PI * 3) * 0.2;
                    this.bones.head.rotation.y = originalRotation.y + Math.sin(progress * Math.PI * 2) * 0.1;
                    requestAnimationFrame(animateGrooming);
                } else {
                    this.bones.head.rotation.x = originalRotation.x;
                    this.bones.head.rotation.y = originalRotation.y;
                }
            };
            animateGrooming();
        }
        
        this.changeState('curious');
        setTimeout(() => this.changeState('idle'), 2000);
    }

    performStretch() {
        console.log('Cat is stretching');
        // Use existing animations creatively for stretching
        this.playAnimation('idle', 0.2, true);
        
        // Simulate stretching with scale animation
        if (this.catModel) {
            const originalScale = this.catModel.scale.clone();
            const stretchDuration = 2000;
            const startTime = Date.now();
            
            const animateStretch = () => {
                const elapsed = Date.now() - startTime;
                const progress = elapsed / stretchDuration;
                
                if (progress < 0.5) {
                    // Stretch phase
                    const stretchAmount = Math.sin(progress * Math.PI) * 0.1;
                    this.catModel.scale.y = originalScale.y * (1 + stretchAmount);
                    this.catModel.scale.x = originalScale.x * (1 - stretchAmount * 0.3);
                } else {
                    // Return to normal
                    const returnProgress = (progress - 0.5) * 2;
                    const easeOut = 1 - Math.pow(1 - returnProgress, 3);
                    this.catModel.scale.lerpVectors(this.catModel.scale, originalScale, easeOut * 0.1);
                }
                
                if (progress < 1) {
                    requestAnimationFrame(animateStretch);
                } else {
                    this.catModel.scale.copy(originalScale);
                }
            };
            animateStretch();
        }
        
        this.changeState('curious');
        setTimeout(() => this.changeState('idle'), 2500);
    }

    performCuriousLook() {
        console.log('Cat is looking around curiously');
        this.changeState('curious');
        
        if (this.bones.head && this.motionController) {
            const lookDuration = 3000;
            const startTime = Date.now();
            const originalRotation = this.bones.head.rotation.y;
            const lookAngles = [-0.5, 0.5, -0.3, 0.7, 0]; // Different look directions
            let currentAngleIndex = 0;
            
            const performLook = () => {
                if (currentAngleIndex < lookAngles.length) {
                    const targetAngle = lookAngles[currentAngleIndex];
                    this.bones.head.rotation.y = originalRotation + targetAngle;
                    currentAngleIndex++;
                    setTimeout(performLook, 600);
                } else {
                    this.bones.head.rotation.y = originalRotation;
                    this.changeState('idle');
                }
            };
            
            performLook();
        }
    }

    performYawn() {
        console.log('Cat is yawning');
        // Use bite animation as yawn simulation
        this.playAnimation('bite', 0.2, false);
        
        if (this.bones.head) {
            const originalRotation = this.bones.head.rotation.x;
            const yawnDuration = 1200;
            const startTime = Date.now();
            
            const animateYawn = () => {
                const elapsed = Date.now() - startTime;
                const progress = elapsed / yawnDuration;
                const yawnIntensity = Math.sin(progress * Math.PI) * 0.3;
                
                this.bones.head.rotation.x = originalRotation - yawnIntensity;
                
                if (progress < 1) {
                    requestAnimationFrame(animateYawn);
                } else {
                    this.bones.head.rotation.x = originalRotation;
                }
            };
            animateYawn();
        }
        
        this.mood = 'sleepy';
        setTimeout(() => {
            this.mood = 'neutral';
            this.changeState('idle');
        }, 1500);
    }

    performSitAndWatch() {
        console.log('Cat sits and watches');
        this.playAnimation('idle', 0.5, true);
        this.changeState('curious');
        
        // Slow, contemplative head movements
        if (this.bones.head) {
            const watchDuration = 4000;
            const startTime = Date.now();
            const originalRotation = { x: this.bones.head.rotation.x, y: this.bones.head.rotation.y };
            
            const animateWatching = () => {
                const elapsed = Date.now() - startTime;
                const progress = elapsed / watchDuration;
                
                if (progress < 1) {
                    this.bones.head.rotation.y = originalRotation.y + Math.sin(progress * Math.PI * 0.5) * 0.4;
                    this.bones.head.rotation.x = originalRotation.x + Math.sin(progress * Math.PI * 0.3) * 0.2;
                    requestAnimationFrame(animateWatching);
                } else {
                    this.bones.head.rotation.x = originalRotation.x;
                    this.bones.head.rotation.y = originalRotation.y;
                    this.changeState('idle');
                }
            };
            animateWatching();
        }
    }

    performPlayfulPounce() {
        console.log('Cat does a playful pounce');
        this.playAnimation('jump', 0.2, false);
        this.changeState('playful');
        
        // Add a small forward movement during pounce
        if (this.catModel && this.motionController) {
            const currentPos = this.catModel.position.clone();
            const pounceDistance = 0.3;
            const pounceDirection = this.catModel.rotation.y;
            
            const targetPos = new THREE.Vector3(
                currentPos.x + Math.sin(pounceDirection) * pounceDistance,
                currentPos.y,
                currentPos.z + Math.cos(pounceDirection) * pounceDistance
            );
            
            this.motionController.moveToPosition(targetPos, 800);
            
            // Update shadow position
            setTimeout(() => {
                if (this.catShadow) {
                    this.catShadow.position.x = targetPos.x;
                    this.catShadow.position.z = targetPos.z;
                }
            }, 800);
        }
        
        setTimeout(() => this.changeState('idle'), 1200);
    }

    performTailChase() {
        console.log('Cat chases its tail');
        this.changeState('playful');
        
        // Rotate in place while doing tail movements
        if (this.catModel && this.proceduralLayer) {
            const originalRotation = this.catModel.rotation.y;
            const chaseDuration = 2500;
            const startTime = Date.now();
            const rotations = 1.5; // 1.5 full rotations
            
            // Intensify tail movement
            this.proceduralLayer.proceduralAnimations.tail.currentIntensity = 0.8;
            this.proceduralLayer.proceduralAnimations.tail.speed = 4.0;
            
            const animateChase = () => {
                const elapsed = Date.now() - startTime;
                const progress = elapsed / chaseDuration;
                
                if (progress < 1) {
                    this.catModel.rotation.y = originalRotation + (progress * Math.PI * 2 * rotations);
                    requestAnimationFrame(animateChase);
                } else {
                    this.catModel.rotation.y = originalRotation;
                    // Reset tail intensity
                    this.proceduralLayer.proceduralAnimations.tail.currentIntensity = 0.2;
                    this.proceduralLayer.proceduralAnimations.tail.speed = 1.0;
                    this.changeState('idle');
                }
            };
            animateChase();
        }
    }

    performNoseSniff() {
        console.log('Cat is sniffing around');
        this.changeState('curious');
        
        if (this.bones.head) {
            const sniffDuration = 2000;
            const startTime = Date.now();
            const originalRotation = { x: this.bones.head.rotation.x, y: this.bones.head.rotation.y };
            
            const animateSniffing = () => {
                const elapsed = Date.now() - startTime;
                const progress = elapsed / sniffDuration;
                
                if (progress < 1) {
                    // Quick sniffing motions
                    const sniffFreq = 8;
                    const sniffIntensity = 0.15;
                    this.bones.head.rotation.x = originalRotation.x + Math.sin(progress * Math.PI * sniffFreq) * sniffIntensity;
                    this.bones.head.rotation.y = originalRotation.y + Math.sin(progress * Math.PI * 3) * 0.2;
                    requestAnimationFrame(animateSniffing);
                } else {
                    this.bones.head.rotation.x = originalRotation.x;
                    this.bones.head.rotation.y = originalRotation.y;
                    this.changeState('idle');
                }
            };
            animateSniffing();
        }
    }

    performRandomOrientation() {
        if (this.motionController && this.catModel && !this.contextController?.isPerformingContextualAction) {
            // Random angle between -45 and +45 degrees from current position
            const currentAngle = this.catModel.rotation.y;
            const randomVariation = (Math.random() - 0.5) * Math.PI * 0.5; // ±45 degrees
            const targetAngle = currentAngle + randomVariation;
            
            this.motionController.rotateTo(targetAngle, 0.8 + Math.random() * 0.4, () => {
                // Optional callback when rotation completes
            });
        }
    }

    performPlayfulAction() {
        const actions = ['jump', 'run', 'walk'];
        const randomAction = actions[Math.floor(Math.random() * actions.length)];
        this.playAnimation(randomAction, 0.2, randomAction === 'jump' ? false : true);

        if (randomAction !== 'jump') {
            setTimeout(() => this.changeState('idle'), 2000);
        }
    }

    performCuriousAction() {
        this.playAnimation('walk', 0.3, true);

        if (this.bones.head) {
            const lookDuration = 3000;
            const startTime = Date.now();
            const originalY = this.bones.head.rotation.y;

            const animateLook = () => {
                const elapsed = Date.now() - startTime;
                const progress = elapsed / lookDuration;

                this.bones.head.rotation.y = originalY + Math.sin(progress * Math.PI * 2) * 0.5;

                if (progress < 1 && this.state === 'curious') {
                    requestAnimationFrame(animateLook);
                } else {
                    this.bones.head.rotation.y = originalY;
                }
            };
            animateLook();
        }
    }

    // ===== SLEEP MODE =====

    enterSleepMode() {
        this.playAnimation('idle', 1.0, true);
        if (this.animationManager) {
            this.animationManager.setSpeed(0.3);
        }

        if (this.catModel) {
            const targetRotation = { x: 0, y: 0, z: Math.PI * 0.15 };
            this.animateModelRotation(targetRotation, 2000);
        }
    }

    exitSleepMode() {
        if (this.animationManager) {
            this.animationManager.setSpeed(1.0);
        }

        if (this.catModel) {
            const targetRotation = { x: 0, y: 0, z: 0 };
            this.animateModelRotation(targetRotation, 1000);
        }
    }

    animateModelRotation(targetRotation, duration) {
        if (!this.catModel) return;

        const startRotation = {
            x: this.catModel.rotation.x,
            y: this.catModel.rotation.y,
            z: this.catModel.rotation.z
        };

        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);

            this.catModel.rotation.x = startRotation.x + (targetRotation.x - startRotation.x) * eased;
            this.catModel.rotation.y = startRotation.y + (targetRotation.y - startRotation.y) * eased;
            this.catModel.rotation.z = startRotation.z + (targetRotation.z - startRotation.z) * eased;

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        animate();
    }

    registerInteraction() {
        this.lastInteractionTime = Date.now();
        if (this.state === 'sleep') {
            this.exitSleepMode();
            this.changeState('playful');
        }
    }

    // ===== MAIN ANIMATION LOOP (FIXED) =====

    // FIXED: Enhanced animation loop with user-facing behavior
    animate() {
        requestAnimationFrame(() => this.animate());
        const delta = this.clock.getDelta();

        // Layer 1: Update animation mixer (GLTF clips)
        if (this.mixer) {
            this.mixer.update(delta);
        }

        // Layer 2: Update procedural animations (additive offsets)
        if (this.proceduralLayer) {
            this.proceduralLayer.update(delta);
        }

        // Layer 3: Update state machine
        if (this.stateMachine) {
            this.stateMachine.update();
        }

        // Update contact shadow position to follow the cat
        // Update cat shadow position to follow the cat
        if (this.catShadow && this.catModel) {
            this.catShadow.position.x = this.catModel.position.x;
            this.catShadow.position.z = this.catModel.position.z;
            
            // Adjust shadow size and opacity based on cat height (for jumping)
            const baseOpacity = 0.1;
            const baseScale = 1.0;
            const heightFactor = Math.max(0.3, 1 - this.catModel.position.y * 0.3);
            this.catShadow.material.opacity = baseOpacity * heightFactor;
            this.catShadow.scale.setScalar(baseScale * heightFactor);
        }

        // FIXED: Enhanced camera facing logic - cat always looks at user
        if (this.catModel && this.camera &&
            !this.contextController?.isPerformingContextualAction &&
            !this.motionController?.isRotating &&
            !this.motionController?.isMoving) {
            // Calculate direction to camera
            const direction = this.camera.position.clone().sub(this.catModel.position);
            direction.y = 0; // Keep on horizontal plane
            direction.normalize();
            // Convert to angle
            const targetAngle = Math.atan2(direction.x, direction.z);
            // FIXED: Smooth rotation towards user with faster response
            const currentRotation = this.catModel.rotation.y;
            const angleDiff = targetAngle - currentRotation;
            // Normalize angle difference to [-PI, PI]
            let normalizedDiff = angleDiff;
            while (normalizedDiff > Math.PI) normalizedDiff -= Math.PI * 2;
            while (normalizedDiff < -Math.PI) normalizedDiff += Math.PI * 2;
            // Apply smooth rotation
            const rotationSpeed = delta * 3; // Faster rotation towards user
            this.catModel.rotation.y += normalizedDiff * rotationSpeed;
        }

        // Render
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    // ===== FIXED STATUS AND UI METHODS =====

    updateStatus(message, iconClass = 'fas fa-info-circle') {
        try {
            const icon = document.getElementById('status-icon');
            if (icon) icon.className = iconClass;
            const statusText = this.status?.querySelector('span');
            if (statusText) statusText.textContent = message;
        } catch (error) {
            console.warn('Status update error:', error);
        }
    }

    async ensurePermissionsUI() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            return;
        }

        let needPrompt = false;
        try {
            const status = await navigator.permissions.query({ name: 'microphone' });
            needPrompt = status.state !== 'granted';
        } catch {
            needPrompt = true;
        }

        if (needPrompt && this.permissionModal) {
            this.permissionModal.style.display = 'flex';
            await new Promise((resolve) => {
                const btn = document.getElementById('grant-permission');
                const onClick = async () => {
                    try {
                        await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                        this.permissionModal.style.display = 'none';
                        btn.removeEventListener('click', onClick);
                        resolve();
                    } catch (e) {
                        console.warn('Permission denied:', e);
                        this.permissionModal.style.display = 'none';
                        btn.removeEventListener('click', onClick);
                        resolve();
                    }
                };

                if (btn) {
                    btn.addEventListener('click', onClick);
                } else {
                    resolve();
                }
            });
        }
    }

    // FIXED: Camera setup with better error handling
    async setupCamera() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.warn('MediaDevices API not supported');
            return;
        }

        try {
            const constraints = {
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user'
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            };

            this.updateStatus('Accessing camera and microphone...', 'fas fa-video');
            this.audioStream = await navigator.mediaDevices.getUserMedia(constraints);
            
            const audioTrack = this.audioStream.getAudioTracks()[0];
            if (audioTrack?.applyConstraints) {
                try {
                    await audioTrack.applyConstraints({
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    });
                } catch (e) {
                    console.warn('Could not apply audio constraints:', e);
                }
            }

            if (this.webcam) {
                this.webcam.srcObject = this.audioStream;
                try {
                    await this.webcam.play();
                    // FIXED: Properly hide webcam overlay
                    const webcamOverlay = document.querySelector('.webcam-overlay');
                    if (webcamOverlay) {
                        webcamOverlay.style.display = 'none';
                    }
                    this.webcam.style.display = 'block';
                } catch (e) {
                    console.warn('Could not play webcam:', e);
                }
            }

            this.updateStatus('Camera and microphone ready', 'fas fa-check');
        } catch (e) {
            console.warn('Camera/microphone access failed:', e);
            this.updateStatus('Camera unavailable, voice features may be limited', 'fas fa-exclamation-triangle');
        }
    }

    // FIXED: Voice chat debugging - enhanced setupSpeechRecognition() method
    setupSpeechRecognition() {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) {
            console.warn('Speech recognition not supported in this browser');
            this.updateStatus('Voice chat not supported in this browser', 'fas fa-exclamation-triangle');
            return;
        }

        try {
            const recognition = new SR();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';
            recognition.maxAlternatives = 1;

            // FIXED: Add more detailed logging for voice chat issues
            recognition.onstart = () => {
                console.log('Speech recognition started');
                this.stateMachine?.changeState('listening');
                this.micButton?.classList.add('listening');
                if (this.micIcon) this.micIcon.className = 'fas fa-stop';
                this.updateStatus('Listening... Speak now!', 'fas fa-microphone');
                this.registerInteraction();
            };

            recognition.onresult = (event) => {
                console.log('Speech recognition result received:', event);
                let interim = '';
                let final = '';

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    const confidence = event.results[i][0].confidence;
                    console.log(`Transcript: "${transcript}", Confidence: ${confidence}, Final: ${event.results[i].isFinal}`);

                    if (event.results[i].isFinal) {
                        final += transcript;
                    } else {
                        interim += transcript;
                    }
                }

                if (interim.trim()) {
                    this.showInterimTranscript(interim.trim());
                    this.updateStatus(`"${interim.trim()}"`, 'fas fa-microphone');
                }

                if (final.trim()) {
                    console.log('Final transcript:', final.trim());
                    this.removeInterimTranscript();
                    this.addMessage(final.trim(), 'user');
                    this.stopListening({ intentional: true });
                    this.processUserInput(final.trim());
                }
            };

            recognition.onerror = (e) => {
                console.error('Speech recognition error:', e.error, e);
                this.removeInterimTranscript();

                // FIXED: Better error messages for voice chat
                let errorMessage = 'Speech recognition error: ';
                switch (e.error) {
                    case 'no-speech':
                        errorMessage += 'No speech detected. Please try again.';
                        break;
                    case 'audio-capture':
                        errorMessage += 'Microphone not accessible. Check permissions.';
                        break;
                    case 'not-allowed':
                        errorMessage += 'Microphone access denied. Please allow microphone access.';
                        break;
                    case 'network':
                        errorMessage += 'Network error. Check your internet connection.';
                        break;
                    default:
                        errorMessage += e.error;
                }

                this.updateStatus(errorMessage, 'fas fa-exclamation-triangle');
                this.stopListening({ intentional: true });
            };

            recognition.onend = () => {
                console.log('Speech recognition ended');
                this.removeInterimTranscript();

                if (this.shouldAutoRestartSTT && this.state === 'listening') {
                    console.log('Attempting to restart speech recognition...');
                    try {
                        recognition.start();
                    } catch (e) {
                        console.warn('Could not restart recognition:', e);
                    }
                } else {
                    this.micButton?.classList.remove('listening');
                    if (this.state === 'listening') this.stateMachine?.changeState('idle');
                    if (this.micIcon) this.micIcon.className = 'fas fa-microphone';
                    this.updateStatus('Ready! Click mic or type to chat', 'fas fa-check');
                }
            };

            this.recognition = recognition;
            console.log('Speech recognition setup complete');
        } catch (e) {
            console.error('Speech recognition setup failed:', e);
            this.updateStatus('Voice chat setup failed', 'fas fa-exclamation-triangle');
        }
    }

    startListening() {
        if (!this.recognition) {
            this.updateStatus('Speech recognition not available', 'fas fa-exclamation-triangle');
            return;
        }

        if (this.state === 'idle') {
            this.shouldAutoRestartSTT = true;
            this.registerInteraction();
            try {
                this.recognition.start();
            } catch (e) {
                console.warn('Could not start recognition:', e);
            }
        }
    }

    stopListening({ intentional = false } = {}) {
        if (!this.recognition) return;
        if (intentional) this.shouldAutoRestartSTT = false;

        try {
            this.recognition.stop();
        } catch (e) {
            console.warn('Could not stop recognition:', e);
        }

        this.micButton?.classList.remove('listening');
        if (this.micIcon) this.micIcon.className = 'fas fa-microphone';
    }

    showInterimTranscript(text) {
        this.removeInterimTranscript();
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message user-message interim-message';
        messageDiv.id = 'interim-transcript';

        const icon = document.createElement('i');
        icon.className = 'fas fa-user';

        const textSpan = document.createElement('span');
        textSpan.textContent = text + 'â€¦';
        textSpan.style.opacity = '0.7';
        textSpan.style.fontStyle = 'italic';

        messageDiv.appendChild(icon);
        messageDiv.appendChild(textSpan);

        if (this.chatMessages) {
            this.chatMessages.appendChild(messageDiv);
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }
    }

    removeInterimTranscript() {
        const interim = document.getElementById('interim-transcript');
        if (interim) interim.remove();
    }

    // FIXED: Keyboard listeners with better event handling
    setupKeyboardListeners() {
        let spacePressed = false;

        document.addEventListener('keydown', (event) => {
            if (event.code === 'Space' && !spacePressed && !event.target.matches('input, textarea')) {
                event.preventDefault();
                spacePressed = true;
                if (this.state === 'idle') this.startListening();
            }
        });

        document.addEventListener('keyup', (event) => {
            if (event.code === 'Space') {
                event.preventDefault();
                spacePressed = false;
                if (this.state === 'listening') this.stopListening({ intentional: true });
            }
        });
    }

    setupChatInput() {
        if (this.chatInput) {
            this.chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendTextMessage();
                }
            });

            this.chatInput.addEventListener('input', () => {
                const message = this.chatInput.value.trim();
                if (this.sendButton) {
                    this.sendButton.disabled = message.length === 0;
                }
            });
        }

        if (this.sendButton) {
            this.sendButton.addEventListener('click', () => this.sendTextMessage());
        }
    }

    sendTextMessage() {
        const message = this.chatInput?.value.trim();
        if (!message) return;

        this.addMessage(message, 'user');
        this.chatInput.value = '';
        if (this.sendButton) {
            this.sendButton.disabled = true;
        }

        this.stopListening({ intentional: true });
        this.processUserInput(message);
    }

    // FIXED: 3D Scene setup with improved lighting and model loading
    // FIXED: 3D Scene setup - prevent clipping
    async setup3DScene() {
        const container = document.getElementById('cat-container') || document.querySelector('.cat-model-container');
        if (!container) {
            throw new Error('Cat container element not found');
        }

        this.scene = new THREE.Scene();
        
        // FIXED: Camera settings optimized for rotoscope-style model
        this.camera = new THREE.PerspectiveCamera(50, container.offsetWidth / container.offsetHeight, 0.1, 50);

        const updateCameraPosition = () => {
            const aspect = container.offsetWidth / container.offsetHeight;
            if (aspect < 1) {
                this.camera.position.set(0, 0.8, 1.8); // Mobile
            } else if (aspect < 1.2) {
                this.camera.position.set(0, 0.8, 1.6); // Tablet  
            } else {
                this.camera.position.set(0, 0.8, 1.5); // Desktop
            }
            this.camera.lookAt(0, 0.8, 0); // Look at the raised model position
        };

        updateCameraPosition();

        this.renderer = new THREE.WebGLRenderer({
            alpha: true,
            antialias: true,
            preserveDrawingBuffer: false,
            premultipliedAlpha: false
        });
        
        const setRendererSize = () => {
            const rect = container.getBoundingClientRect();
            const width = Math.max(rect.width, 200);
            const height = Math.max(rect.height, 200);
            this.renderer.setSize(width, height);
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        };
        
        setRendererSize();
        
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;

        container.appendChild(this.renderer.domElement);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
        directionalLight.position.set(2, 4, 3);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.setScalar(2048);
        this.scene.add(directionalLight);

        const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
        fillLight.position.set(-2, 2, -2);
        this.scene.add(fillLight);

        // FIXED: Enhanced ground with visible shadow
        // Enhanced ground with better shadow reception
        const groundGeo = new THREE.CircleGeometry(3, 32);
        const groundMat = new THREE.ShadowMaterial({
            opacity: 0.15,
            color: 0x000000
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.05;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Create a soft circular shadow under the cat
        const shadowGeo = new THREE.CircleGeometry(0.4, 16);
        const shadowMat = new THREE.MeshBasicMaterial({
            color: 0x000000,
            opacity: 0.1,
            transparent: true,
            depthWrite: false
        });
        const catShadow = new THREE.Mesh(shadowGeo, shadowMat);
        catShadow.rotation.x = -Math.PI / 2;
        catShadow.position.y = 0.02;
        this.catShadow = catShadow; // Store reference
        this.scene.add(catShadow);

        await this.loadCatModel();

        const handleResize = () => {
            if (!this.renderer || !this.camera || !container) return;
            
            const rect = container.getBoundingClientRect();
            const width = Math.max(rect.width, 200);
            const height = Math.max(rect.height, 200);
            
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(width, height);
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
            
            updateCameraPosition();
        };

        if (window.ResizeObserver) {
            const resizeObserver = new ResizeObserver(handleResize);
            resizeObserver.observe(container);
            this.resizeObserver = resizeObserver;
        } else {
            window.addEventListener('resize', handleResize);
            this.windowResizeHandler = handleResize;
        }
        
        window.addEventListener('orientationchange', () => {
            setTimeout(handleResize, 100);
        });

        window.addEventListener('beforeunload', () => this.teardown());
    }

    // FIXED: Model loading with perfect scaling
    async loadCatModel() {
        const loader = new THREE.GLTFLoader();
        this.updateStatus('Loading enhanced cat model...', 'fas fa-spinner fa-spin');
        try {
            const gltf = await loader.loadAsync('./models/free_toon_shiba_inu_3d_model.glb');
            this.catModel = gltf.scene;

            // FIXED: Perfect positioning to prevent ALL clipping issues
            this.catModel.position.set(0, 0, 0);
            this.catModel.rotation.y = 0;

            // FIXED: Perfect scaling to fit container
            // FIXED: Perfect scaling and positioning
            const box = new THREE.Box3().setFromObject(this.catModel);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());

            // Calculate optimal scale
            const maxDim = Math.max(size.x, size.y, size.z);
            const targetSize = 1.0; // Smaller scale for better fit
            if (maxDim > 0) {
                const scale = targetSize / maxDim;
                this.catModel.scale.setScalar(scale);
            }

            // FIXED: Position the model higher and center it properly
            this.catModel.position.sub(center.multiplyScalar(this.catModel.scale.x));
            this.catModel.position.y = 0.8; // Move much higher up
            this.catModel.position.z = 0; // Center depth-wise
            this.catModel.position.x = 0; // Center horizontally

            // FIXED: Enhanced material settings for perfect visibility
            this.catModel.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    
                    // CRITICAL: Complete frustum culling disable
                    child.frustumCulled = false;
                    child.matrixAutoUpdate = true;
                    
                    if (child.material) {
                        // FIXED: Force material properties for visibility
                        child.material.needsUpdate = true;
                        child.material.transparent = false;
                        child.material.alphaTest = 0;
                        child.material.side = THREE.FrontSide;
                        child.material.clipIntersection = false;
                        child.material.clippingPlanes = [];
                        
                        // CRITICAL: Depth and rendering fixes
                        child.material.depthWrite = true;
                        child.material.depthTest = true;
                        child.material.polygonOffset = false;
                        
                        // Enhanced texture properties
                        if (child.material.map) {
                            child.material.map.colorSpace = THREE.SRGBColorSpace;
                            child.material.map.flipY = false;
                            child.material.map.needsUpdate = true;
                        }
                        
                        // Force immediate material update
                        child.material.needsUpdate = true;
                    }
                    
                    // FIXED: Ensure proper render order
                    child.renderOrder = 10;
                    child.matrixWorldNeedsUpdate = true;
                }
            });

            // FIXED: Model-level settings for guaranteed visibility
            this.catModel.renderOrder = 10;
            this.catModel.matrixAutoUpdate = true;
            this.catModel.frustumCulled = false;
            
            this.scene.add(this.catModel);
            
            this.mixer = new THREE.AnimationMixer(this.catModel);
            this.mixer.addEventListener('finished', (e) => {
                if (!e?.action) return;
                const ended = e.action;
                if (ended.loop === THREE.LoopOnce) {
                    setTimeout(() => this.returnToIdleAndFaceUser(), 100);
                }
            });

            await this.loadAnimations();
            this.findAndCacheBones();
        } catch (e) {
            console.error('Model loading failed:', e);
            this.createSimpleFallback();
        }
    }

    // FIXED: Animation loading with better error handling
    async loadAnimations() {
        if (!this.mixer) return;

        const loader = new THREE.GLTFLoader();
        const files = [
            { file: 'free_toon_shiba_inu_3d_model_idle.glb', name: 'idle', loop: THREE.LoopRepeat },
            { file: 'free_toon_shiba_inu_3d_model_walk.glb', name: 'walk', loop: THREE.LoopRepeat },
            { file: 'free_toon_shiba_inu_3d_model_run.glb', name: 'run', loop: THREE.LoopRepeat },
            { file: 'free_toon_shiba_inu_3d_model_jump.glb', name: 'jump', loop: THREE.LoopOnce },
            { file: 'free_toon_shiba_inu_3d_model_paw_attack.glb', name: 'paw_attack', loop: THREE.LoopOnce },
            { file: 'free_toon_shiba_inu_3d_model_bite_attack.glb', name: 'bite', loop: THREE.LoopOnce },
        ];

        for (const { file, name, loop } of files) {
            try {
                const gltf = await loader.loadAsync(`./models/${file}`);
                if (gltf.animations && gltf.animations.length > 0) {
                    const clip = gltf.animations[0];
                    const action = this.mixer.clipAction(clip);
                    action.setLoop(loop, loop === THREE.LoopOnce ? 1 : Infinity);
                    action.clampWhenFinished = (loop === THREE.LoopOnce);
                    action.enabled = true;
                    this.animations[name] = action;
                }
            } catch (e) {
                console.warn(`Failed to load animation ${name}:`, e);
            }
        }
    }

    // FIXED: Bone finding with better error handling
    findAndCacheBones() {
        if (!this.catModel) return;

        this.catModel.traverse((child) => {
            if (child.isBone || child.type === 'Bone') {
                const name = child.name.toLowerCase();

                if (name.includes('head') || name.includes('skull') || name.includes('cranium')) {
                    this.bones.head = child;
                }

                if ((name.includes('tail') || name.includes('spine')) && !this.bones.tail) {
                    if (name.includes('tail1') || name.includes('tail_01') || name.includes('tail.001')) {
                        this.bones.tail = child;
                    }
                }

                if (name.includes('ear')) {
                    if (name.includes('left') || name.includes('l_')) {
                        this.bones.ears.left = child;
                    } else if (name.includes('right') || name.includes('r_')) {
                        this.bones.ears.right = child;
                    }
                }

                if (name.includes('spine') && name.includes('1')) {
                    this.bones.spine = child;
                }
            }
        });
    }

    // FIXED: Event listeners with better error handling
    setupEventListeners() {
        // Microphone button
        if (this.micButton) {
            this.micButton.addEventListener('click', () => {
                if (this.state === 'listening') {
                    this.stopListening({ intentional: true });
                    this.stateMachine?.changeState('idle');
                    this.updateStatus('Ready! Click mic or type to chat', 'fas fa-check');
                } else if (this.state === 'idle') {
                    this.startListening();
                }
            });
        }

        // FIXED: Quick action buttons - corrected event listeners
        document.querySelectorAll('.cat-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                console.log('Button clicked:', btn.className);
                
                // Get action from class names
                let action = '';
                if (btn.classList.contains('walk-btn')) action = 'walk';
                else if (btn.classList.contains('run-btn')) action = 'run';
                else if (btn.classList.contains('jump-btn')) action = 'jump';
                else if (btn.classList.contains('sit-btn')) action = 'sit';
                
                if (action) {
                    console.log('Performing action:', action);
                    this.performActionFromUI(action);
                } else {
                    console.warn('No action found for button:', btn.className);
                }
            });
        });

        // FIXED: Enable webcam button with proper hiding
        const enableWebcamBtn = document.getElementById('enable-webcam');
        if (enableWebcamBtn) {
            enableWebcamBtn.addEventListener('click', async () => {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({
                        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
                        audio: false
                    });
                    const webcamVideo = document.getElementById('webcam');
                    const webcamOverlay = document.querySelector('.webcam-overlay');
                    if (webcamVideo) {
                        webcamVideo.srcObject = stream;
                        webcamVideo.style.display = 'block';
                        await webcamVideo.play();
                        // FIXED: Properly hide the overlay
                        if (webcamOverlay) {
                            webcamOverlay.style.display = 'none';
                        }
                    }
                } catch (error) {
                    console.error('Webcam access error:', error);
                    alert('Unable to access webcam. Please check permissions.');
                }
            });
        }
    }

    // FIXED: Action from UI with proper integration
    performActionFromUI(actionName) {
        console.log('Performing action from UI:', actionName);
        const actionMap = {
            'walk': 'walk',
            'run': 'run',
            'jump': 'jump',
            'sit': 'idle',
            'wave': 'paw_attack'
        };
        
        const animationName = actionMap[actionName] || 'idle';
        this.playAnimation(animationName, 0.3, animationName === 'jump' ? false : true);
        
        // FIXED: Clean responses without corrupted emojis
        const responses = {
            'walk': ["Time for a little walk! *stretches paws*", "Walking feels so good, want to join me?", "Let me show you my walking skills!"],
            'run': ["Whee! Time to run! I feel so energetic!", "Running is so much fun! Look at me go!", "Zoom zoom! I'm fast like lightning!"],
            'jump': ["Whee! Look how high I can jump!", "*lands gracefully* Did you see that jump?", "Bouncy bouncy! I love jumping around!"],
            'sit': ["*sits down comfortably* Ahh, much better!", "I'm sitting like a good kitty!", "Perfect sitting posture, don't you think?"],
            'wave': ["Hello there! *waves paw*", "Hi! I'm waving at you! Do you see me?", "Paw wave for my favorite human!"]
        };
        
        const actionResponses = responses[actionName] || ["Meow! That was fun!", "Did you like that move?"];
        const randomResponse = actionResponses[Math.floor(Math.random() * actionResponses.length)];
        
        setTimeout(() => {
            this.addMessage(randomResponse, 'cat');
            this.speakText(randomResponse);
        }, 800);
        
        this.registerInteraction();
    }

    addMessage(text, sender) {
        if (!this.chatMessages) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;

        const icon = document.createElement('i');
        icon.className = sender === 'user' ? 'fas fa-user' : 'fas fa-cat';

        const textSpan = document.createElement('span');
        textSpan.textContent = text;

        messageDiv.appendChild(icon);
        messageDiv.appendChild(textSpan);
        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    // FIXED: Enhanced user input processing
    async processUserInput(text) {
        this.registerInteraction();
        this.stateMachine?.changeState('processing');
        this.micButton?.classList.add('processing');
        this.updateStatus('Thinking...', 'fas fa-spinner fa-spin');

        this.lastUserMessage = text;
        this.updateConversationHistory('user', text);

        // Check for explicit animation commands first
        const animationTriggered = this.checkAnimationCommand(text);
        if (animationTriggered) {
            try {
                const response = await this.queryGemini(`I just performed a ${text} action as Neko the AI cat. React to my own action with excitement or satisfaction. Keep it brief and natural.`);
                this.addMessage(response, 'cat');
                this.speakText(response);
                this.updateConversationHistory('assistant', response);
            } catch {
                const fallback = 'Whee! Look at me go! Did you see that awesome move I just did?';
                this.addMessage(fallback, 'cat');
                this.speakText(fallback);
                this.updateConversationHistory('assistant', fallback);
            }

            this.finishProcessing();
            return;
        }

        try {
            const contextualPrompt = this.buildContextualPrompt(text);
            const response = await this.queryGemini(contextualPrompt);
            this.addMessage(response, 'cat');
            this.speakText(response);
            this.updateConversationHistory('assistant', response);

            // Trigger contextual actions using the layered system
            if (this.contextController) {
                setTimeout(() => {
                    this.contextController.analyzeAndTriggerContextualAction(text, response);
                }, 1500);
            }

        } catch (error) {
            console.error('Gemini API error:', error);
            const fallbackResponse = "I'm having some connection issues right now. Can you try asking me again?";
            this.addMessage(fallbackResponse, 'cat');
            this.speakText(fallbackResponse);
            this.updateConversationHistory('assistant', fallbackResponse);
        } finally {
            this.finishProcessing();
        }
    }

    buildContextualPrompt(currentMessage) {
        let contextualPrompt = currentMessage;

        if (this.conversationHistory.length > 0) {
            const recentHistory = this.conversationHistory.slice(-4);
            const historyText = recentHistory.map(msg =>
                `${msg.role === 'user' ? 'Human' : 'Neko'}: ${msg.content}`
            ).join('\n');

            contextualPrompt = `Previous conversation context:
${historyText}

Current message: ${currentMessage}

Respond as Neko, keeping the conversation context in mind.`;
        }

        return contextualPrompt;
    }

    finishProcessing() {
        this.stateMachine?.changeState('idle');
        this.micButton?.classList.remove('processing');
        this.updateStatus('Ready! Click mic or type to chat', 'fas fa-check');

        if (this.sendButton && this.chatInput) {
            this.sendButton.disabled = this.chatInput.value.trim().length === 0;
        }

        this.idleStartTime = Date.now();
    }

    checkAnimationCommand(text) {
        const commands = [
            { rx: /\b(sit|idle)\b/i, anim: 'idle' },
            { rx: /\bjump\b/i, anim: 'jump' },
            { rx: /\brun\b/i, anim: 'run' },
            { rx: /\bwalk\b/i, anim: 'walk' },
            { rx: /\b(dance|groove)\b/i, anim: 'walk' },
            { rx: /\b(wave|hello|hi)\b/i, anim: 'paw_attack' },
            { rx: /\bbite\b/i, anim: 'bite' },
        ];

        for (const c of commands) {
            if (c.rx.test(text)) {
                this.playAnimation(c.anim, 0.3, c.anim === 'jump' ? false : true);
                return true;
            }
        }
        return false;
    }

    // FIXED: Voice finding with better compatibility
    async findBestVoice() {
        if (!this.synthesis) return;

        const synth = this.synthesis;
        const loadVoicesOnce = () =>
            new Promise((resolve) => {
                const got = synth.getVoices();
                if (got && got.length) return resolve(got);

                let resolved = false;
                const onChanged = () => {
                    const vs = synth.getVoices();
                    if (vs && vs.length && !resolved) {
                        resolved = true;
                        synth.removeEventListener('voiceschanged', onChanged);
                        resolve(vs);
                    }
                };

                synth.addEventListener('voiceschanged', onChanged);

                let elapsed = 0;
                const interval = 200;
                const max = 2000;

                const poll = setInterval(() => {
                    const vs = synth.getVoices();
                    elapsed += interval;

                    if ((vs && vs.length) || elapsed >= max) {
                        clearInterval(poll);
                        if (!resolved) {
                            synth.removeEventListener('voiceschanged', onChanged);
                            resolve(vs || []);
                        }
                    }
                }, interval);
            });

        const voices = await loadVoicesOnce();
        if (!voices || voices.length === 0) return;

        const prefs = [
            'Zira', 'Microsoft Zira', 'Karen', 'Microsoft Karen',
            'Samantha', 'Anna', 'Vicki', 'Google US English Female'
        ];

        for (const p of prefs) {
            const v = voices.find(v => (v?.name?.includes(p)) || (v?.voiceURI?.includes(p)));
            if (v) {
                this.preferredVoice = v;
                break;
            }
        }

        if (!this.preferredVoice) {
            this.preferredVoice = voices.find(v => v?.lang?.startsWith('en')) || voices[0];
        }
    }

    // FIXED: Enhanced speaking with proper animation coordination
    speakText(text) {
        if (!this.synthesis) return;

        const wasListening = this.state === 'listening';
        if (wasListening) this.stopListening({ intentional: true });

        this.changeState('talking');
        this.isTalking = true;
        this.synthesis.cancel();

        const utter = new SpeechSynthesisUtterance(text);
        utter.rate = 1.1;
        utter.pitch = 1.4;
        utter.volume = 0.9;

        if (this.preferredVoice) utter.voice = this.preferredVoice;

        utter.onstart = () => {
            this.startAudioAnalysis();
        };

        utter.onend = () => {
            this.isTalking = false;
            this.talkingIntensity = 0;

            // Immediate and reliable transition to idle
            this.changeState('idle');

            // Ensure animation returns to idle with smooth transition
            if (this.animationManager) {
                this.animationManager.fadeToIdle(0.8);
            }

            // Reset cat to face camera with smooth rotation
            if (this.catModel && this.camera) {
                const direction = this.camera.position.clone().sub(this.catModel.position);
                const targetAngle = Math.atan2(direction.x, direction.z);
                if (this.motionController) {
                    this.motionController.rotateTo(targetAngle, 1.2, () => {
                        // Successfully facing user
                    });
                }
            }
        };

        utter.onerror = (e) => {
            console.error('Speech synthesis error:', e);
            this.isTalking = false;
            this.changeState('idle');
        };

        this.synthesis.speak(utter);
    }

    updateConversationHistory(role, content) {
        this.conversationHistory.push({
            role: role,
            content: content,
            timestamp: Date.now()
        });

        if (this.conversationHistory.length > 10) {
            this.conversationHistory = this.conversationHistory.slice(-10);
        }
    }

    // FIXED: Gemini API with better error handling and endpoints
    async queryGemini(text) {
        if (!this.configLoaded || !this.GEMINI_API_KEY) {
            throw new Error('Configuration not loaded');
        }
        const systemPrompt = `You are Neko, an AI cat companion with a warm, playful personality and lifelike behaviors. You're curious, friendly, and love chatting with humans.

    Your characteristics:
    - You're a cat, so you have feline instincts and perspectives
    - You're curious about the world and love learning
    - You're playful but not childish
    - You're warm and genuinely interested in the human you're talking to
    - You have your own opinions and preferences
    - You can be a bit mischievous in a cute way
    - You can make cat sounds like 'meow' once or twice in a while, but don't overdo it

    Important guidelines:
    - Keep responses conversational and natural (15-50 words)
    - Sound like a real friend who happens to be a cat
    - Don't use action tags like *purrs* or *meows*
    - Answer questions thoughtfully and authentically
    - Show genuine interest in what the human is saying
    - Feel free to share your own cat-like perspectives and experiences
    - Ask follow-up questions when it makes sense
    - Remember previous parts of our conversation and reference them naturally
    - NEVER use emojis or special Unicode characters in responses
    - Use only standard ASCII characters and basic punctuation

    Context: You are having an ongoing conversation with enhanced lifelike behaviors. Use context from previous messages to make your responses more relevant and engaging.

    H: ${text}

    Respond as Neko:`;

        const endpoints = [
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${this.GEMINI_API_KEY}`,
            `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${this.GEMINI_API_KEY}`,
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.GEMINI_API_KEY}`
        ];

        const requestBody = {
            contents: [{
                parts: [{ text: systemPrompt }]
            }],
            generationConfig: {
                temperature: 0.9,
                topK: 32,
                topP: 0.95,
                maxOutputTokens: 200,
                stopSequences: ["Human:", "User:"]
            },
            safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
            ]
        };

        for (let i = 0; i < endpoints.length; i++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000);
                
                const response = await fetch(endpoints[i], {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8',
                        'User-Agent': 'Mozilla/5.0 (compatible; TalkingCat/1.0)'
                    },
                    body: JSON.stringify(requestBody),
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    const errorText = await response.text();
                    if (i === endpoints.length - 1) {
                        throw new Error(`API error ${response.status}: ${errorText}`);
                    }
                    continue;
                }

                const data = await response.json();
                let responseText = '';
                
                if (data.candidates && data.candidates[0]) {
                    const candidate = data.candidates[0];
                    if (candidate.content && candidate.content.parts && candidate.content.parts[0]) {
                        responseText = candidate.content.parts[0].text;
                    } else if (candidate.text) {
                        responseText = candidate.text;
                    }
                }

                if (!responseText && data.text) {
                    responseText = data.text;
                }

                if (!responseText) {
                    if (i === endpoints.length - 1) {
                        throw new Error('Empty response from Gemini');
                    }
                    continue;
                }

                responseText = responseText.trim();
                
                // Remove any unwanted prefixes
                const prefixesToRemove = ['Neko:', 'Cat:', 'AI:', 'Assistant:', 'Response:'];
                for (const prefix of prefixesToRemove) {
                    if (responseText.startsWith(prefix)) {
                        responseText = responseText.substring(prefix.length).trim();
                    }
                }

                // FIXED: Clean up any corrupted Unicode/emoji characters
                responseText = this.cleanTextContent(responseText);

                // Limit response length
                const words = responseText.split(/\s+/);
                if (words.length > 80) {
                    responseText = words.slice(0, 80).join(' ') + '...';
                }

                return responseText;
            } catch (error) {
                console.warn(`Gemini endpoint ${i + 1} failed:`, error);
                if (i === endpoints.length - 1) {
                    throw error;
                }
            }
        }
        throw new Error('All API endpoints failed');
    }

// FIXED: Add text cleaning method
cleanTextContent(text) {
    // Remove corrupted emoji sequences and replace with safe alternatives
    return text
        .replace(/ðŸ[^\s]*/g, '') // Remove corrupted emoji patterns
        .replace(/â€[^\s]*/g, '') // Remove corrupted punctuation
        .replace(/[^\x00-\x7F]/g, '') // Remove all non-ASCII characters
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
}

    // FIXED: Audio analysis setup
    setupAudioAnalysis() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            this.audioData = new Uint8Array(this.analyser.frequencyBinCount);
        } catch (e) {
            console.warn('Audio analysis setup failed:', e);
        }
    }

    startAudioAnalysis() {
        if (!this.audioContext || !this.analyser) return;

        const updateAudioData = () => {
            if (this.isTalking) {
                this.analyser.getByteFrequencyData(this.audioData);
                let sum = 0;
                for (let i = 0; i < this.audioData.length; i++) {
                    sum += this.audioData[i];
                }
                this.talkingIntensity = sum / this.audioData.length / 255;
                requestAnimationFrame(updateAudioData);
            }
        };
        updateAudioData();
    }

    clearAnimationTimeout(animName) {
        if (this.animationTimeouts.has(animName)) {
            clearTimeout(this.animationTimeouts.get(animName));
            this.animationTimeouts.delete(animName);
        }
    }

    // FIXED: Comprehensive teardown method
    teardown() {
        try {
            for (const timeoutId of this.animationTimeouts.values()) {
                clearTimeout(timeoutId);
            }
            this.animationTimeouts.clear();

            if (this.proactiveBehaviorTimer) {
                clearInterval(this.proactiveBehaviorTimer);
                this.proactiveBehaviorTimer = null;
            }

            this.stopEnhancedIdleBehaviors();

            if (this.audioStream) {
                this.audioStream.getTracks().forEach(t => t.stop());
            }

            if (this.synthesis) {
                this.synthesis.cancel();
            }

            if (this.recognition) {
                try {
                    this.recognition.abort();
                } catch (e) {
                    console.warn('Recognition abort failed:', e);
                }
            }

            if (this.audioContext) {
                try {
                    this.audioContext.close();
                } catch (e) {
                    console.warn('Audio context close failed:', e);
                }
            }

            if (this.renderer) {
                this.renderer.dispose();
            }

            if (this.animationManager) {
                this.animationManager.clearTimeouts();
            }

            if (this.actionScheduler) {
                this.actionScheduler.cancelAll();
            }

            if (this.resizeObserver) {
                this.resizeObserver.disconnect();
                this.resizeObserver = null;
            }
            
            if (this.windowResizeHandler) {
                window.removeEventListener('resize', this.windowResizeHandler);
                this.windowResizeHandler = null;
            }

        } catch (e) {
            console.warn('Teardown error:', e);
        }
    }
}

// ===== APPLICATION BOOTSTRAP =====

document.addEventListener('DOMContentLoaded', () => {
    const permissionModal = document.getElementById('permission-modal');
    const grantButton = document.getElementById('grant-permission');

    if (grantButton) {
        grantButton.addEventListener('click', async () => {
            try {
                await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                if (permissionModal) {
                    permissionModal.style.display = 'none';
                }
            } catch (error) {
                console.warn('Permission grant failed:', error);
                if (permissionModal) {
                    permissionModal.style.display = 'none';
                }
            }
        });
    }

    // Initialize the enhanced talking cat with layered animation system
    const enhancedCat = new EnhancedTalkingCat();

    // Global reference for debugging
    window.enhancedCat = enhancedCat;
});

// ===== AUTO-SAVE CONVERSATION FEATURE =====

const saveConversation = () => {
    if (!window.enhancedCat?.conversationHistory) return;
    try {
        const conversation = {
            timestamp: new Date().toISOString(),
            history: window.enhancedCat.conversationHistory,
            sessionDuration: Date.now() - (window.enhancedCat.idleStartTime || Date.now())
        };
        localStorage.setItem('neko_conversation', JSON.stringify(conversation));
    } catch (e) {
        console.warn('Conversation save failed:', e);
    }
};

// Auto-save every 5 minutes
setInterval(saveConversation, 5 * 60 * 1000);

// Save on page unload
window.addEventListener('beforeunload', saveConversation);

// ===== LOAD PREVIOUS CONVERSATION =====

const loadPreviousConversation = () => {
    try {
        const saved = localStorage.getItem('neko_conversation');
        if (saved) {
            const data = JSON.parse(saved);
            const timeSinceLastSession = Date.now() - new Date(data.timestamp).getTime();
            // Only restore if session was within last 24 hours
            if (timeSinceLastSession < 24 * 60 * 60 * 1000) {
                return data.history || [];
            }
        }
    } catch (e) {
        console.warn('Conversation load failed:', e);
    }
    return [];
};

// ===== INITIALIZE WITH SAVED CONVERSATION =====

setTimeout(() => {
    if (window.enhancedCat) {
        const previousHistory = loadPreviousConversation();
        if (previousHistory.length > 0) {
            window.enhancedCat.conversationHistory = previousHistory;
            // Show a brief welcome back message
            const welcomeBackMessages = [
                "Welcome back! I remember our previous chat ðŸ˜Š",
                "Hi again! Ready to continue where we left off?",
                "Good to see you again! What would you like to talk about?"
            ];
            const randomWelcome = welcomeBackMessages[Math.floor(Math.random() * welcomeBackMessages.length)];

            setTimeout(() => {
                if (window.enhancedCat.addMessage && window.enhancedCat.speakText) {
                    window.enhancedCat.addMessage(randomWelcome, 'cat');
                    window.enhancedCat.speakText(randomWelcome);
                }
            }, 3000);
        }
    }
}, 2000);

// Export for module systems (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { EnhancedTalkingCat };

}

