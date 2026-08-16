const fs = require('fs');

const originalContent = fs.readFileSync('src/App.tsx', 'utf8');

const targetStr = `  const startConversion = async () => {
    const pendingImages = images.filter(img => img.status === 'pending');
    if (pendingImages.length === 0) return;
    
    let allDone: ConvertedImage[] = [];
    setIsConverting(true);
    stopConversionRef.current = false;
    
    for (const imgObj of pendingImages) {
      if (stopConversionRef.current) break;

      // Check credits for each image (in case they run out mid-batch)
      if (!profile?.isUnlimited && (profile?.credits || 0) <= 0) {
        addToast('Ran out of credits!', 'error');
        break;
      }
      
      setImages(prev => prev.map(img => 
        img.id === imgObj.id ? { ...img, status: 'converting' } : img
      ));
      
      const startTime = performance.now();
      try {
        const finalCreatorName = enableCreator ? (creatorName.trim() || user?.displayName || 'Unknown Creator') : '';
        const convertedBlob = await convertImage(imgObj.file, finalCreatorName);
        
        // Deduct credit & track processed
        if (profile) {
          const userDocRef = doc(db, 'users', profile.uid);
          updateDoc(userDocRef, {
            credits: profile.isUnlimited ? increment(0) : increment(-1),
            processedCount: increment(1)
          }).catch(err => console.error("Error updating stats:", err));
        }

        const endTime = performance.now();
        const timeTaken = Math.max(10, endTime - startTime);
        
        const now = Date.now();
        recentTimesRef.current.push({ timestamp: now, duration: timeTaken });
        recentTimesRef.current = recentTimesRef.current.filter(entry => now - entry.timestamp <= 5000);
        
        if (recentTimesRef.current.length > 0) {
          const avg = recentTimesRef.current.reduce((a, b) => a + b.duration, 0) / recentTimesRef.current.length;
          setAvgTimePerImage(avg);
        }
        
        setSessionStats(prev => ({
          fastestTime: Math.min(prev.fastestTime, timeTaken),
          slowestTime: Math.max(prev.slowestTime, timeTaken),
          totalProcessed: prev.totalProcessed + 1,
        }));
        
        setImages(prev => prev.map(img => {
          if (img.id === imgObj.id) {
            const updated = { 
              ...img, 
              status: 'done' as const, 
              blob: convertedBlob, 
              convertedSize: convertedBlob.size 
            };
            allDone.push(updated);
            return updated;
          }
          return img;
        }));

        if (autoExportOneByOneRef.current) {
          const newName = imgObj.originalName.replace(/\\.[^/.]+$/, "") + ".jpg";
          downloadBlob(convertedBlob, newName);
        }
      } catch (error) {
        console.error("Failed to convert image:", error);
        setImages(prev => prev.map(img => 
          img.id === imgObj.id ? { ...img, status: 'error' } : img
        ));
      }
    }
    
    setIsConverting(false);`;

const newStr = `  const startConversion = async () => {
    const pendingImages = images.filter(img => img.status === 'pending');
    if (pendingImages.length === 0) return;
    
    let allDone: ConvertedImage[] = [];
    setIsConverting(true);
    stopConversionRef.current = false;
    
    let successfulConversionsCount = 0;
    let localCredits = profile?.credits || 0;
    
    for (const imgObj of pendingImages) {
      if (stopConversionRef.current) break;

      // Check credits for each image using local tracker
      if (!profile?.isUnlimited && localCredits <= 0) {
        addToast('Ran out of credits!', 'error');
        break;
      }
      
      setImages(prev => prev.map(img => 
        img.id === imgObj.id ? { ...img, status: 'converting' } : img
      ));
      
      const startTime = performance.now();
      try {
        const finalCreatorName = enableCreator ? (creatorName.trim() || user?.displayName || 'Unknown Creator') : '';
        const convertedBlob = await convertImage(imgObj.file, finalCreatorName);
        
        // Track success locally instead of writing to Firestore every time
        successfulConversionsCount++;
        if (!profile?.isUnlimited) {
          localCredits--;
        }

        const endTime = performance.now();
        const timeTaken = Math.max(10, endTime - startTime);
        
        const now = Date.now();
        recentTimesRef.current.push({ timestamp: now, duration: timeTaken });
        recentTimesRef.current = recentTimesRef.current.filter(entry => now - entry.timestamp <= 5000);
        
        if (recentTimesRef.current.length > 0) {
          const avg = recentTimesRef.current.reduce((a, b) => a + b.duration, 0) / recentTimesRef.current.length;
          setAvgTimePerImage(avg);
        }
        
        setSessionStats(prev => ({
          fastestTime: Math.min(prev.fastestTime, timeTaken),
          slowestTime: Math.max(prev.slowestTime, timeTaken),
          totalProcessed: prev.totalProcessed + 1,
        }));
        
        setImages(prev => prev.map(img => {
          if (img.id === imgObj.id) {
            const updated = { 
              ...img, 
              status: 'done' as const, 
              blob: convertedBlob, 
              convertedSize: convertedBlob.size 
            };
            allDone.push(updated);
            return updated;
          }
          return img;
        }));

        if (autoExportOneByOneRef.current) {
          const newName = imgObj.originalName.replace(/\\.[^/.]+$/, "") + ".jpg";
          downloadBlob(convertedBlob, newName);
        }
      } catch (error) {
        console.error("Failed to convert image:", error);
        setImages(prev => prev.map(img => 
          img.id === imgObj.id ? { ...img, status: 'error' } : img
        ));
      }
    }
    
    // Batch Firestore update at the end to save writes
    if (profile && successfulConversionsCount > 0) {
      const userDocRef = doc(db, 'users', profile.uid);
      updateDoc(userDocRef, {
        credits: profile.isUnlimited ? increment(0) : increment(-successfulConversionsCount),
        processedCount: increment(successfulConversionsCount)
      }).catch(err => console.error("Error updating stats:", err));
    }
    
    setIsConverting(false);`;

if(originalContent.includes(targetStr)) {
    fs.writeFileSync('src/App.tsx', originalContent.replace(targetStr, newStr));
    console.log("Replaced successfully");
} else {
    console.log("Target string not found. Please review manually.");
}
