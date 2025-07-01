// File: tests/deliveryNote.test.js
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const Client = require('../models/Client');
const Project = require('../models/Project');
const DeliveryNote = require('../models/DeliveryNote');

describe('DeliveryNote API Tests', () => {
   let testUser, userToken, testClient, testProject, testDeliveryNote;

   beforeAll(async () => {
      await User.deleteMany({});
      await Client.deleteMany({});
      await Project.deleteMany({});
      await DeliveryNote.deleteMany({});
   });

   afterAll(async () => {
      await User.deleteMany({});
      await Client.deleteMany({});
      await Project.deleteMany({});
      await DeliveryNote.deleteMany({});
      await mongoose.connection.close();
   });

   beforeEach(async () => {
      await User.deleteMany({});
      await Client.deleteMany({});
      await Project.deleteMany({});
      await DeliveryNote.deleteMany({});

      // Create test user
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash('Password123', 10);
      testUser = new User({
         name: 'Test',
         surname: 'User',
         email: 'test@example.com',
         password: hashedPassword,
         isEmailVerified: true,
         role: 'user'
      });
      await testUser.save();

      // Generate token
      const jwt = require('jsonwebtoken');
      userToken = jwt.sign(
         { id: testUser._id, email: testUser.email, role: testUser.role },
         process.env.JWT_SECRET
      );

      // Create test client
      testClient = new Client({
         name: 'Test Client',
         email: 'client@test.com',
         createdBy: testUser._id,
         archived: false
      });
      await testClient.save();

      // Create test project
      testProject = new Project({
         name: 'Test Project',
         description: 'Test description',
         client: testClient._id,
         createdBy: testUser._id,
         archived: false
      });
      await testProject.save();
   });

   // ===================== CREATE DELIVERY NOTE =====================
   describe('POST /api/deliverynote', () => {
      it('should create a new delivery note successfully', async () => {
         const deliveryNoteData = {
            deliveryNoteNumber: 'DN-2025-001',
            projectId: testProject._id,
            date: new Date().toISOString(),
            items: [
               {
                  description: 'Development hours',
                  quantity: 8,
                  unitPrice: 50,
                  person: 'John Developer'
               },
               {
                  description: 'Analysis and documentation',
                  quantity: 4,
                  unitPrice: 60,
                  person: 'Jane Analyst'
               }
            ],
            notes: 'Initial development phase completed'
         };

         const res = await request(app)
            .post('/api/deliverynote')
            .set('Authorization', `Bearer ${userToken}`)
            .send(deliveryNoteData)
            .expect(201);

         expect(res.body.message).toBe('Delivery note created successfully.');
         expect(res.body.data).toBeDefined();
         expect(res.body.data.deliveryNoteNumber).toBe(deliveryNoteData.deliveryNoteNumber);
         expect(res.body.data.project).toBe(testProject._id.toString());
         expect(res.body.data.client).toBe(testClient._id.toString());
         expect(res.body.data.items).toHaveLength(2);
         expect(res.body.data.items[0].description).toBe('Development hours');
         expect(res.body.data.items[0].quantity).toBe(8);
         expect(res.body.data.items[0].unitPrice).toBe(50);
         expect(res.body.data.items[0].person).toBe('John Developer');
         expect(res.body.data.totalAmount).toBe(640); // (8*50) + (4*60)
         expect(res.body.data.status).toBe('draft');
         expect(res.body.data.isSigned).toBe(false);
         expect(res.body.data.createdBy).toBe(testUser._id.toString());
         expect(res.body.data.notes).toBe(deliveryNoteData.notes);
      });

      it('should create delivery note without notes', async () => {
         const deliveryNoteData = {
            deliveryNoteNumber: 'DN-2025-002',
            projectId: testProject._id,
            date: new Date().toISOString(),
            items: [
               {
                  description: 'Consulting hours',
                  quantity: 2,
                  unitPrice: 75
               }
            ]
         };

         const res = await request(app)
            .post('/api/deliverynote')
            .set('Authorization', `Bearer ${userToken}`)
            .send(deliveryNoteData)
            .expect(201);

         expect(res.body.data.notes).toBeUndefined();
         expect(res.body.data.totalAmount).toBe(150);
      });

      it('should fail with missing required fields', async () => {
         const invalidData = {
            deliveryNoteNumber: 'DN-2025-003',
            // Missing projectId, date, items
         };

         const res = await request(app)
            .post('/api/deliverynote')
            .set('Authorization', `Bearer ${userToken}`)
            .send(invalidData)
            .expect(400);

         expect(res.body.message).toBe('Validation failed');
         expect(res.body.data.errors).toBeDefined();
      });

      it('should fail with invalid project ID', async () => {
         const deliveryNoteData = {
            deliveryNoteNumber: 'DN-2025-004',
            projectId: new mongoose.Types.ObjectId(),
            date: new Date().toISOString(),
            items: [{ description: 'Test', quantity: 1, unitPrice: 10 }]
         };

         const res = await request(app)
            .post('/api/deliverynote')
            .set('Authorization', `Bearer ${userToken}`)
            .send(deliveryNoteData)
            .expect(404);

         expect(res.body.message).toBe('Project not found or access denied.');
      });

      it('should fail with duplicate delivery note number', async () => {
         // Create first delivery note
         const deliveryNoteData = {
            deliveryNoteNumber: 'DN-DUPLICATE-001',
            projectId: testProject._id,
            date: new Date().toISOString(),
            items: [{ description: 'Test', quantity: 1, unitPrice: 10 }]
         };

         await request(app)
            .post('/api/deliverynote')
            .set('Authorization', `Bearer ${userToken}`)
            .send(deliveryNoteData)
            .expect(201);

         // Try to create duplicate
         const res = await request(app)
            .post('/api/deliverynote')
            .set('Authorization', `Bearer ${userToken}`)
            .send(deliveryNoteData)
            .expect(409);

         expect(res.body.message).toBe('Delivery note number already exists.');
      });

      it('should fail without authentication', async () => {
         const deliveryNoteData = {
            deliveryNoteNumber: 'DN-2025-005',
            projectId: testProject._id,
            date: new Date().toISOString(),
            items: [{ description: 'Test', quantity: 1, unitPrice: 10 }]
         };

         const res = await request(app)
            .post('/api/deliverynote')
            .send(deliveryNoteData)
            .expect(401);

         expect(res.body.message).toBe('No token, authorization denied');
      });
   });

   // ===================== GET ALL DELIVERY NOTES =====================
   describe('GET /api/deliverynote', () => {
      beforeEach(async () => {
         await DeliveryNote.create([
            {
               deliveryNoteNumber: 'DN-001',
               project: testProject._id,
               client: testClient._id,
               date: new Date('2025-01-15'),
               items: [{ description: 'Hours', quantity: 8, unitPrice: 50 }],
               totalAmount: 400,
               status: 'draft',
               isSigned: false,
               createdBy: testUser._id
            },
            {
               deliveryNoteNumber: 'DN-002',
               project: testProject._id,
               client: testClient._id,
               date: new Date('2025-01-20'),
               items: [{ description: 'Materials', quantity: 2, unitPrice: 100 }],
               totalAmount: 200,
               status: 'sent',
               isSigned: true,
               createdBy: testUser._id
            }
         ]);
      });

      it('should get all delivery notes successfully with exact structure', async () => {
         const res = await request(app)
            .get('/api/deliverynote')
            .set('Authorization', `Bearer ${userToken}`)
            .expect(200);

         expect(res.body.message).toBe('Delivery notes retrieved successfully.');
         expect(res.body.count).toBe(2);
         expect(Array.isArray(res.body.data)).toBe(true);
         expect(res.body.data).toHaveLength(2);

         // Check sorting (newest first)
         expect(new Date(res.body.data[0].date).getTime()).toBeGreaterThan(new Date(res.body.data[1].date).getTime());

         // Check populated fields
         expect(res.body.data[0].client.name).toBe('Test Client');
         expect(res.body.data[0].project.name).toBe('Test Project');

         // Check IPFS URLs are included
         expect(res.body.data[1]).toHaveProperty('signatureGatewayUrl');
         expect(res.body.data[1]).toHaveProperty('pdfGatewayUrl');
      });

      it('should return empty array when no delivery notes exist', async () => {
         await DeliveryNote.deleteMany({ createdBy: testUser._id });

         const res = await request(app)
            .get('/api/deliverynote')
            .set('Authorization', `Bearer ${userToken}`)
            .expect(200);

         expect(res.body.message).toBe('Delivery notes retrieved successfully.');
         expect(res.body.count).toBe(0);
         expect(res.body.data).toHaveLength(0);
      });

      it('should not return other users delivery notes', async () => {
         // Create another user and their delivery note
         const otherUser = new User({
            name: 'Other', surname: 'User', email: 'other@test.com',
            password: await require('bcrypt').hash('Pass123', 10), isEmailVerified: true
         });
         await otherUser.save();

         // Crear cliente para el otro usuario
         const otherClient = new Client({
            name: 'Other Client',
            email: 'otherclient@test.com',
            createdBy: otherUser._id,
            archived: false
         });
         await otherClient.save();

         // Crear proyecto para el otro usuario
         const otherProject = new Project({
            name: 'Other Project',
            description: 'Other description',
            client: otherClient._id,
            createdBy: otherUser._id,
            archived: false
         });
         await otherProject.save();

         await new DeliveryNote({
            deliveryNoteNumber: 'DN-OTHER-001',
            project: otherProject._id,  // Usar el proyecto del otro usuario
            client: otherClient._id,     // Usar el cliente del otro usuario
            date: new Date(),
            items: [{ description: 'Other work', quantity: 1, unitPrice: 100 }],
            totalAmount: 100,
            createdBy: otherUser._id
         }).save();

         const res = await request(app)
            .get('/api/deliverynote')
            .set('Authorization', `Bearer ${userToken}`)
            .expect(200);

         expect(res.body.count).toBe(2); // Still only user's notes
         expect(res.body.data.every(note => note.createdBy === testUser._id.toString())).toBe(true);
      });

      it('should fail without authentication', async () => {
         const res = await request(app)
            .get('/api/deliverynote')
            .expect(401);

         expect(res.body.message).toBe('No token, authorization denied');
      });
   });

   // ===================== GET DELIVERY NOTE BY ID =====================
   describe('GET /api/deliverynote/:id', () => {
      beforeEach(async () => {
         testDeliveryNote = new DeliveryNote({
            deliveryNoteNumber: 'DN-SINGLE-001',
            project: testProject._id,
            client: testClient._id,
            date: new Date(),
            items: [
               { description: 'Development', quantity: 8, unitPrice: 60, person: 'Developer' },
               { description: 'Testing', quantity: 4, unitPrice: 50 }
            ],
            totalAmount: 680,
            status: 'draft',
            isSigned: false,
            notes: 'Test delivery note',
            createdBy: testUser._id
         });
         await testDeliveryNote.save();
      });

      it('should get delivery note by ID with exact structure', async () => {
         const res = await request(app)
            .get(`/api/deliverynote/${testDeliveryNote._id}`)
            .set('Authorization', `Bearer ${userToken}`)
            .expect(200);

         expect(res.body.message).toBe('Delivery note retrieved successfully.');
         expect(res.body.data).toBeDefined();
         expect(res.body.data._id).toBe(testDeliveryNote._id.toString());
         expect(res.body.data.deliveryNoteNumber).toBe('DN-SINGLE-001');
         expect(res.body.data.totalAmount).toBe(680);
         expect(res.body.data.notes).toBe('Test delivery note');

         // Check populated fields
         expect(res.body.data.createdBy.email).toBe(testUser.email);
         expect(res.body.data.client.name).toBe('Test Client');
         expect(res.body.data.project.name).toBe('Test Project');

         // Check IPFS gateway URLs
         expect(res.body.data).toHaveProperty('signatureGatewayUrl');
         expect(res.body.data).toHaveProperty('pdfGatewayUrl');
      });

      it('should fail with invalid ObjectId format', async () => {
         const res = await request(app)
            .get('/api/deliverynote/invalid-id')
            .set('Authorization', `Bearer ${userToken}`)
            .expect(400);

         expect(res.body.message).toBe('Validation failed');
      });

      it('should fail with non-existent delivery note ID', async () => {
         const nonExistentId = new mongoose.Types.ObjectId();

         const res = await request(app)
            .get(`/api/deliverynote/${nonExistentId}`)
            .set('Authorization', `Bearer ${userToken}`)
            .expect(404);

         expect(res.body.message).toBe('Delivery note not found or access denied.');
      });

      it('should fail when accessing other users delivery note', async () => {
         // Create another user
         const otherUser = new User({
            name: 'Other', surname: 'User', email: 'other@test.com',
            password: await require('bcrypt').hash('Pass123', 10), isEmailVerified: true
         });
         await otherUser.save();

         // Crear cliente para el otro usuario
         const otherClient = new Client({
            name: 'Other Client',
            email: 'otherclient@test.com',
            createdBy: otherUser._id,
            archived: false
         });
         await otherClient.save();

         // Crear proyecto para el otro usuario
         const otherProject = new Project({
            name: 'Other Project',
            description: 'Other description',
            client: otherClient._id,
            createdBy: otherUser._id,
            archived: false
         });
         await otherProject.save();

         // Create delivery note for other user
         const otherNote = new DeliveryNote({
            deliveryNoteNumber: 'DN-OTHER-001',
            project: otherProject._id,    // Usar el proyecto del otro usuario
            client: otherClient._id,      // Usar el cliente del otro usuario
            date: new Date(),
            items: [{ description: 'Other work', quantity: 1, unitPrice: 100 }],
            totalAmount: 100,
            createdBy: otherUser._id
         });
         await otherNote.save();

         const res = await request(app)
            .get(`/api/deliverynote/${otherNote._id}`)
            .set('Authorization', `Bearer ${userToken}`)
            .expect(404);

         expect(res.body.message).toBe('Delivery note not found or access denied.');
      });
   });

   // ===================== UPDATE DELIVERY NOTE =====================
   describe('PUT /api/deliverynote/:id', () => {
      beforeEach(async () => {
         testDeliveryNote = new DeliveryNote({
            deliveryNoteNumber: 'DN-UPDATE-001',
            project: testProject._id,
            client: testClient._id,
            date: new Date(),
            items: [{ description: 'Initial work', quantity: 5, unitPrice: 40 }],
            totalAmount: 200,
            status: 'draft',
            isSigned: false,
            createdBy: testUser._id
         });
         await testDeliveryNote.save();
      });

      it('should update delivery note successfully', async () => {
         const updateData = {
            deliveryNoteNumber: 'DN-UPDATE-001-REVISED',
            items: [
               { description: 'Updated development', quantity: 8, unitPrice: 50, person: 'Senior Dev' },
               { description: 'Code review', quantity: 2, unitPrice: 60 }
            ],
            notes: 'Updated with additional work'
         };

         const res = await request(app)
            .put(`/api/deliverynote/${testDeliveryNote._id}`)
            .set('Authorization', `Bearer ${userToken}`)
            .send(updateData)
            .expect(200);

         expect(res.body.message).toBe('Delivery note updated successfully.');
         expect(res.body.data.deliveryNoteNumber).toBe('DN-UPDATE-001-REVISED');
         expect(res.body.data.items).toHaveLength(2);
         expect(res.body.data.totalAmount).toBe(520); // (8*50) + (2*60)
         expect(res.body.data.notes).toBe('Updated with additional work');
      });

      it('should fail to update signed delivery note', async () => {
         // Mark as signed
         testDeliveryNote.isSigned = true;
         testDeliveryNote.status = 'signed';
         await testDeliveryNote.save();

         const updateData = {
            deliveryNoteNumber: 'DN-ATTEMPT-UPDATE',
            items: [{ description: 'Should not work', quantity: 1, unitPrice: 1 }]
         };

         const res = await request(app)
            .put(`/api/deliverynote/${testDeliveryNote._id}`)
            .set('Authorization', `Bearer ${userToken}`)
            .send(updateData)
            .expect(403);

         expect(res.body.message).toBe('Cannot update a signed delivery note.');
      });

      it('should fail with invalid delivery note ID', async () => {
         const nonExistentId = new mongoose.Types.ObjectId();
         const updateData = {
            deliveryNoteNumber: 'DN-NONEXISTENT',
            items: [{ description: 'Test', quantity: 1, unitPrice: 10 }]
         };

         const res = await request(app)
            .put(`/api/deliverynote/${nonExistentId}`)
            .set('Authorization', `Bearer ${userToken}`)
            .send(updateData)
            .expect(404);

         expect(res.body.message).toBe('Delivery note not found or access denied.');
      });

      it('should fail without authentication', async () => {
         const updateData = {
            deliveryNoteNumber: 'DN-NO-AUTH',
            items: [{ description: 'Test', quantity: 1, unitPrice: 10 }]
         };

         const res = await request(app)
            .put(`/api/deliverynote/${testDeliveryNote._id}`)
            .send(updateData)
            .expect(401);

         expect(res.body.message).toBe('No token, authorization denied');
      });
   });

   // ===================== SIGN DELIVERY NOTE =====================
   describe('POST /api/deliverynote/:id/sign', () => {
      beforeEach(async () => {
         testDeliveryNote = new DeliveryNote({
            deliveryNoteNumber: 'DN-SIGN-001',
            project: testProject._id,
            client: testClient._id,
            date: new Date(),
            items: [{ description: 'Work to sign', quantity: 6, unitPrice: 45 }],
            totalAmount: 270,
            status: 'sent',
            isSigned: false,
            createdBy: testUser._id
         });
         await testDeliveryNote.save();
      });

      it('should sign delivery note successfully', async () => {
         const signData = {
            signatureUrl: 'ipfs://QmTestSignatureHash',
            signedDate: new Date().toISOString()
         };

         const res = await request(app)
            .patch(`/api/deliverynote/sign/${testDeliveryNote._id}`)
            .set('Authorization', `Bearer ${userToken}`)
            .send(signData)
            .expect(200);

         expect(res.body.message).toBe('Delivery note signed and PDF uploaded successfully.');
         expect(res.body.data.isSigned).toBe(true);
      });

      it('should fail to sign already signed delivery note', async () => {
         // Mark as already signed
         testDeliveryNote.isSigned = true;
         testDeliveryNote.status = 'signed';
         await testDeliveryNote.save();

         const signData = {
            signature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            signerName: 'John Client'
         };

         const res = await request(app)
            .patch(`/api/deliverynote/sign/${testDeliveryNote._id}`)
            .set('Authorization', `Bearer ${userToken}`)
            .send(signData)
            .expect(400);

         expect(res.body.message).toBe('Delivery note is already signed.');
      });

      it('should fail with missing signature data', async () => {
         const invalidSignData = {
            signerName: 'John Client'
            // Missing signature
         };

         const res = await request(app)
            .patch(`/api/deliverynote/sign/${testDeliveryNote._id}`)
            .set('Authorization', `Bearer ${userToken}`)
            .send(invalidSignData)
            .expect(400);

         expect(res.body.message).toBe('Validation failed');
      });

      it('should fail with invalid delivery note ID', async () => {
         const nonExistentId = new mongoose.Types.ObjectId();
         const signData = {
            signature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            signerName: 'John Client'
         };

         const res = await request(app)
            .patch(`/api/deliverynote/sign/${nonExistentId}`)
            .set('Authorization', `Bearer ${userToken}`)
            .send(signData)
            .expect(404);

         expect(res.body.message).toBe('Delivery note not found or access denied.');
      });

      it('should fail without authentication', async () => {
         const signData = {
            signature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            signerName: 'John Client'
         };

         const res = await request(app)
            .patch(`/api/deliverynote/sign/${testDeliveryNote._id}`)
            .send(signData)
            .expect(401);

         expect(res.body.message).toBe('No token, authorization denied');
      });
   });

   // ===================== DELETE DELIVERY NOTE =====================
   describe('DELETE /api/deliverynote/:id', () => {
      beforeEach(async () => {
         testDeliveryNote = new DeliveryNote({
            deliveryNoteNumber: 'DN-DELETE-001',
            project: testProject._id,
            client: testClient._id,
            date: new Date(),
            items: [{ description: 'Work to delete', quantity: 3, unitPrice: 30 }],
            totalAmount: 90,
            status: 'draft',
            isSigned: false,
            createdBy: testUser._id
         });
         await testDeliveryNote.save();
      });

      it('should delete unsigned delivery note successfully', async () => {
         const res = await request(app)
            .delete(`/api/deliverynote/${testDeliveryNote._id}`)
            .set('Authorization', `Bearer ${userToken}`)
            .expect(200);

         expect(res.body.message).toBe('Delivery note deleted successfully.');

         // Verify it's actually deleted
         const deletedNote = await DeliveryNote.findById(testDeliveryNote._id);
         expect(deletedNote).toBeNull();
      });

      it('should fail to delete signed delivery note', async () => {
         // Mark as signed
         testDeliveryNote.isSigned = true;
         testDeliveryNote.status = 'signed';
         await testDeliveryNote.save();

         const res = await request(app)
            .delete(`/api/deliverynote/${testDeliveryNote._id}`)
            .set('Authorization', `Bearer ${userToken}`)
            .expect(403);

         expect(res.body.message).toBe('Cannot delete a signed delivery note.');

         // Verify it still exists
         const existingNote = await DeliveryNote.findById(testDeliveryNote._id);
         expect(existingNote).toBeTruthy();
      });

      it('should fail with invalid ObjectId format', async () => {
         const res = await request(app)
            .delete('/api/deliverynote/invalid-id')
            .set('Authorization', `Bearer ${userToken}`)
            .expect(400);

         expect(res.body.message).toBe('Validation failed');
      });

      it('should fail with non-existent delivery note ID', async () => {
         const nonExistentId = new mongoose.Types.ObjectId();

         const res = await request(app)
            .delete(`/api/deliverynote/${nonExistentId}`)
            .set('Authorization', `Bearer ${userToken}`)
            .expect(404);

         expect(res.body.message).toBe('Delivery note not found or access denied.');
      });

      it('should fail without authentication', async () => {
         const res = await request(app)
            .delete(`/api/deliverynote/${testDeliveryNote._id}`)
            .expect(401);

         expect(res.body.message).toBe('No token, authorization denied');
      });
   });
});
