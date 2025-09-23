@@ .. @@
-- Allow updating own worker profile
CREATE POLICY "Users can update own worker profile"
ON workers
FOR UPDATE
TO authenticated
-USING (auth.uid() = id)
+USING (auth.uid() = id OR email = auth.email())
WITH CHECK (auth.uid() = id);